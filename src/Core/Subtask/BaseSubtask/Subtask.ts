import { SubtaskType, SubtaskStatus, SubtaskOptions } from "../../../Constants/SubtaskConstants";
import { SubtaskModel, SubtaskModelClass } from "../../../Models/SubtaskModel";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { MessageStatus } from "../../../Constants/MessageConstants";
import { Expose, Transform } from "class-transformer";
import { format } from "date-fns";
import { ExposeGroups } from "../../../Constants/ToJsonConstants";
import { Actor } from "../../Actor";
import { Database } from "../../../Database";
import { ClientSession, Types } from "mongoose";
import { TransactionCallback } from "../../../Handlers";
import { BusinessException } from "../../../Exceptions/BusinessException";
export abstract class Subtask{
    database:Database
    @Expose()
    id:Types.ObjectId;

    @Expose()
    type:SubtaskType;
    @Expose()
    status: SubtaskStatus;
    @Expose()
    is_health:boolean;

    @Expose()
    data:string|object;
    // @Expose()
    // options:SubtaskOptions;

    @Expose()
    @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    created_at:Number;

    // @Expose()
    // @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    // updated_at:Number;
    @Expose()
    processor:string;
    @Expose()
    message_id:string;

    @Expose()
    public producer_id:number

    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public producer:Actor;



    @Expose({groups:[ExposeGroups.SUBTASK_MESSAGE]})
    message:TransactionMessage;
    model:SubtaskModel

    timeout:number;


    constructor(message:TransactionMessage){
        this.database = message.database;
        this.message = message;
        this.producer = message.producer;
        // this.model = new this.database.SubtaskModel();
    }
    protected async initProperties(subtaskModel:SubtaskModel){
        this.model = subtaskModel;
        this.id = subtaskModel.id;

        this.status = subtaskModel.status
        this.is_health = subtaskModel.is_health
        this.data = subtaskModel.data
        // this.options = subtaskModel.options
        this.created_at = subtaskModel.created_at
        // this.updated_at = subtaskModel.updated_at
        this.message_id = subtaskModel.message_id.toHexString()
        this.producer_id = subtaskModel.producer_id
    }

    public async createModel(body){
        this.model = new this.database.SubtaskModel();
        this.model.producer_id = this.producer.id;

        this.model.message_id = this.message.id;

        this.model.job_id = Types.ObjectId();
        this.model.type = this.type;

        this.model.is_health = true;
        this.model.data = body.data;

        this.model.options = {
            attempts: 3,
            timeout: 60,
            delay:0,
        }; 
        this.timeout = body.options?.timeout ? body.options.timeout : 1000*10
        this.model.options = Object.assign(this.model.options,body.options || {});
        // this.model.updated_at = new Date().getTime();
        // this.model.created_at = new Date().getTime()
    }

    // public async create(body,session:ClientSession){
    //     await this.model.save({session}); 
    // }
    
    async restore(subtaskModel){
        await this.initProperties(subtaskModel);
    };

    abstract create(body,session:ClientSession):Promise<any>

    abstract confirm();
    abstract cancel();
    abstract toDo();
    abstract toCancel();

    public async getStatus(){
        // return <SubtaskStatus>await this.message.producer.redisClient.hget(this.getDbHash(),'status');
        let subtaskModel =  await this.database.SubtaskModel.findById(this.id).select('status');
        return subtaskModel.status;
    }
    async setStatus(originStatus:SubtaskStatus,targetStatus:SubtaskStatus,session:ClientSession){
        let updatedSubtaskModel = await this.database.SubtaskModel
        .findOneAndUpdate({_id: this.id,status: originStatus},{
            $set:{
                status: targetStatus
            }
        },{session,new:true});

        if(!updatedSubtaskModel){
            let exists = await this.database.SubtaskModel.exists({_id: this.id});
            if(!exists){
                throw new BusinessException('SUBTASK_SET_STATUS_NOT_FOUND')
            }
            let currentStatus = await this.getStatus();
            throw new BusinessException('SUBTASK_SET_STATUS_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus,targetStatus})
        };
        this.status = updatedSubtaskModel.status;
    }

    async setStatusWithTransacation(originStatus:SubtaskStatus,targetStatus:SubtaskStatus,callback:TransactionCallback=null){
        let session = await this.database.connection.startSession();

        await session.withTransaction(async()=>{
            await this.setStatus(originStatus,targetStatus,session);
            callback && await callback(session)
        })
        await session.endSession();
    }

    setProperty(name,value){
        this[name] = value;
        // this.model.property(name,value);
        return this;
    }
    public getDbHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    // public async completeAndSetMeesageStatusByScript(redisClient,status,messageStatus:MessageStatus){
    //     return redisClient['subtaskCompleteAndSetMessageStatus'](this.id,this.message.id,status,messageStatus,new Date().getTime());    
    // }

    public async completeAndCompleteMessage(originStatus:SubtaskStatus,targetStatus:SubtaskStatus,messageOriginStatus:MessageStatus,messageTargetStatus:MessageStatus){

        await this.setStatusWithTransacation(originStatus,targetStatus,async(session)=>{//设置subtask状态

            //修改message的剩余子任务数量
            let messageIncSubtaskTotalResult = await this.database.MessageModel
            .findOneAndUpdate({
                _id: this.message.id,
                status: messageOriginStatus
            },{
                $inc:{
                    pending_subtask_total: -1,
                }
            },{session});

            if(!messageIncSubtaskTotalResult){
                let exists = await this.database.MessageModel.exists({_id: this.id});
                if(!exists){
                    throw new BusinessException('MESSAGE_DEC_SUBTASK_TOTAL_NOT_FOUND')
                }
                let currentStatus = await this.message.getStatus();
                throw new BusinessException('MESSAGE_DEC_SUBTASK_TOTAL_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus:messageOriginStatus})
            }

            let messageUpdateStatusResult = await this.database.MessageModel.findOneAndUpdate({
                _id: this.message.id,
                status: messageOriginStatus,//状态为原始状态
                pending_subtask_total:0//未完成subtask数量为0
            },{
                $set:{
                    status:messageTargetStatus
                }
            },{session});

        })
    }
    // public async completeAndSetMeesageStatus(status,messageStatus){
    //     var [subtaskUpdatedStatus,
    //         messageOriginStatus,
    //         messageUpdatedStatus,
    //         pendingSubtaskTotal,
    //     ] = await this.completeAndSetMeesageStatusByScript(this.producer.redisClient,status,messageStatus);    
  
        
    //     //修改instance中的值,但是不save,防止其他地方用到
    //     // this.setStatus(subtaskUpdatedStatus); 
    //     // this.message.setStatus(messageUpdatedStatus);
    //     return pendingSubtaskTotal;
    // }
    async save(){
        // this.model.property('updated_at',new Date().getTime());
        return this.model.save();
    }

    public getJobID(){
        // return this.model.property('job_id');
    }
    public async delete(){ 
        await this.model.remove();
    }

    public async refresh(){
        // let subtaskModel = await this.producer.subtaskModel.load(this.id);
        // await this.initProperties(subtaskModel);
        let subtaskModel = await this.producer.subtaskManager.getSubtaskModel(this.id);
        await this.initProperties(subtaskModel);
        return this;
    }
}