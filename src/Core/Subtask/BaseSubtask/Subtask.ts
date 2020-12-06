import { SubtaskType, SubtaskStatus, SubtaskOptions } from "../../../Constants/SubtaskConstants";
import { SubtaskModelClass } from "../../../Models/SubtaskModel";
import { Job } from "../../Job/Job";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { MessageStatus } from "../../../Constants/MessageConstants";
import { Expose, Transform } from "class-transformer";
import { format } from "date-fns";
import { ExposeGroups } from "../../../Constants/ToJsonConstants";
import { Actor } from "../../Actor";
export abstract class Subtask{
    @Expose()
    id:number;
    @Expose()
    type:SubtaskType;
    @Expose()
    status: SubtaskStatus;

    @Expose()
    data:string|object;
    @Expose()
    options:SubtaskOptions;

    @Expose()
    @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    created_at:Number;

    @Expose()
    @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    updated_at:Number;
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
    model:SubtaskModelClass


    constructor(message:TransactionMessage){
        
        this.message = message;
        this.producer = message.producer;
    }
    protected async initProperties(subtaskModel){
        this.model = subtaskModel;
        this.id = subtaskModel.id;
        // this.type = subtaskModel.property('type');
        this.status = subtaskModel.property('status');
        this.data = subtaskModel.property('data');
        this.options = subtaskModel.property('options');
        this.created_at = subtaskModel.property('created_at');
        this.updated_at = subtaskModel.property('updated_at');
        this.message_id = subtaskModel.property('message_id');
        this.producer_id = subtaskModel.property('producer_id');
    }
    public async createSubtaskModel(body){
        
        let subtaskModel = new this.message.producer.subtaskModel();
        subtaskModel.id = body.subtask_id; 

        subtaskModel.property('producer_id',this.producer.id);
        subtaskModel.property('message_id',this.message.id);//rename message_id
        subtaskModel.property('job_id',-1);//默认值必须手动设置，否则在重新设置值的时候，不会从默认值中删除索引
        subtaskModel.property('type',this.type);
        subtaskModel.property('status',SubtaskStatus.PREPARING);
        subtaskModel.property('data',body.data);
        subtaskModel.property('options',body.options);
        subtaskModel.property('updated_at',new Date().getTime());
        subtaskModel.property('created_at',new Date().getTime());
        return subtaskModel;
    }

    public async create(body){
        let subtaskModel  = await this.createSubtaskModel(body);
        await subtaskModel.save() 
        await this.initProperties(subtaskModel)
    }
    async restore(subtaskModel){
        await this.initProperties(subtaskModel);
    };
    abstract async prepare();
    abstract async confirm();
    abstract async cancel();
    abstract async toDo();
    abstract async toCancel();

    public async getStatus(){
        return await this.message.producer.redisClient.hget(this.getDbHash(),'status');
    }
    setStatus(status:SubtaskStatus){
        this.status = status;
        this.model.property('status',this.status);
        return this;
    }
    setProperty(name,value){
        this[name] = value;
        this.model.property(name,value);
        return this;
    }
    public getDbHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    public async completeAndSetMeesageStatusByScript(redisClient,status,messageStatus:MessageStatus){
        return redisClient['subtaskCompleteAndSetMessageStatus'](this.id,this.message.id,'updated_at',status,messageStatus,new Date().getTime());    
    }
    public async completeAndSetMeesageStatus(status,messageStatus){
        
        var [subtaskUpdatedStatus,
            messageOriginStatus,
            messageUpdatedStatus,
            pendingSubtaskTotal,
        ] = await this.completeAndSetMeesageStatusByScript(this.producer.redisClient,status,messageStatus);    
  
        
        //修改instance中的值,但是不save,防止其他地方用到
        this.setStatus(subtaskUpdatedStatus); 
        this.message.setStatus(messageUpdatedStatus);
        return pendingSubtaskTotal;
    }
    async save(){
        this.model.property('updated_at',new Date().getTime());
        return this.model.save();
    }

    public getJobID(){
        return this.model.property('job_id');
    }
    public async delete(){ 
        await this.model.remove();
    }
}