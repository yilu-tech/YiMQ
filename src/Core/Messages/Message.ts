import { Actor } from "../Actor";
import { MessageStatus, MessageType, MessageClearStatus } from "../../Constants/MessageConstants";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { MessageModel, MessageModelClass } from "../../Models/MessageModel";
import * as bull from 'bull';
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import {  Expose, Transform } from "class-transformer";
import { format, isThisMinute } from "date-fns";
import {  ExposeGroups, OnDemandSwitch } from "../../Constants/ToJsonConstants";
import { OnDemand } from "../../Decorators/OnDemand";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { SystemException } from "../../Exceptions/SystemException";
import { timeout, TransactionCallback } from "../../Handlers";
import { Logger } from "@nestjs/common";
import { lowerCase } from "lodash";
import { RedisClient } from "../../Handlers/redis/RedisClient";
import IORedis from "ioredis";
import { Database } from "../../Database";
import { BusinessException } from "../../Exceptions/BusinessException";
import { ClientSession, Types } from "mongoose";
import { JobOptions } from "../../Interfaces/JobOptions";
import { MessageOptions } from "../../Interfaces/MessageInterfaces";

export interface SubtaskContext{
    consumer_id:number
    processor:string
    subtask_id:number
}

export abstract class Message{
    database:Database
    @Expose()
    id:Types.ObjectId;

    @Expose()
    actor_id:number;

    @Expose()
    topic: string;

    @Expose()
    full_topic:string;

    @Expose()
    status: MessageStatus;

    @Expose()
    is_health:boolean;

    @Expose()
    data:any;

    @Expose()
    job_id: Types.ObjectId;

    @Expose()
    @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    updated_at: Number;

    @Expose()
    @Transform(value => format(Number(value),'yyyy-MM-dd HH:mm:ss'))
    created_at: Number;

    @Expose()
    public type: MessageType; //普通消息，事物消息
    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public producer:Actor;
    
    @Expose({groups:[ExposeGroups.MESSAGE_JOB]})
    public job:Job;
    public model:MessageModel

    // @Expose()
    // public subtask_ids:string[];

    @Expose()
    public subtasks:Subtask[] = [];  //事物的子项目
    @Expose()
    public subtask_total:number;
    @Expose()
    public pending_subtask_total:number;

    @Expose()
    public clear_status:string;

    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public parent_subtask_producer:Actor;
    @Expose()
    public parent_subtask_id:string;

    public parent_subtask:Subtask;

    private message_lock_key:string;

    constructor(producer:Actor){

        this.producer = producer;
        this.database = producer.actorManager.application.database;
    }

    async createMessageModel(topic,data,options:MessageOptions){
        // this.model = new this.producer.messageModel();
        this.model = new this.producer.actorManager.application.database.MessageModel({});
        
        // this.model.id = String(await this.producer.actorManager.getMessageGlobalId());
        // this.model.property('id',this.model.id);
        // this.model.property('actor_id',this.producer.id);
        this.model.actor_id = this.producer.id;
        // this.model.property('topic',topic);
        this.model.topic = topic;
        // this.model.property('type',this.type);
        this.model.type = this.type;
        // this.model.property('status',MessageStatus.PENDING);
        this.model.status = MessageStatus.PENDING;
        // this.model.property('is_health',true);
        this.model.is_health = true;
        // this.model.property('clear_status',MessageClearStatus.WAITING);
        this.model.clear_status = MessageClearStatus.WAITING;


        if(options.parent_subtask){
            let parent_subtask_info = options.parent_subtask.split('@');
            let producer = this.producer.actorManager.get(parent_subtask_info[0]);
            if(!producer){
                throw new SystemException(`producer not exist of parent_subtask ${options.parent_subtask}.`)
            }
            let parent_subtask = `${producer.id}@${parent_subtask_info[1]}`;
            // this.model.property('parent_subtask',parent_subtask)
            this.model.parent_subtask = parent_subtask;
        }else{
            // this.model.property('parent_subtask','-1')
            this.model.parent_subtask = '-1';
        }

        if(data){
            // this.model.property('data',data)
            this.model.data = data;
        }
        
        // this.model.property('created_at',new Date().getTime());
        this.model.created_at = new Date().getTime();
        return this;
    }


    /**
     * 创建message对应的job
     * @param options 
     */
    async create(topic:string, options:MessageOptions):Promise<any>{

        
        await this.initProperties();
        let messageJobOptions:JobOptions = {
            delay: options.delay || 1000 * 10
        }
        // this.job = await this.producer.jobManager.add(this,JobType.MESSAGE,messageJobOptions,async(session,job)=>{
        //     this.model.job_id = job.id;
        //     await this.model.save({session})
        //     if(process.env.NODE_ENV == 'test' && this.topic == 'create_job_failed') throw new BusinessException('create_job_failed')
        // });

        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            this.job = this.producer.jobManager.factory(this,JobType.MESSAGE);
            await this.job.create(messageJobOptions,session);
            this.model.job_id = this.job.id;
            await this.model.save({session})
            if(process.env.NODE_ENV == 'test' && this.topic == 'create_job_failed') throw new BusinessException('create_job_failed')

        })
        await session.endSession();
     
        await this.initProperties();
    
        return this;
    };

    async initProperties(){
        this.id = this.model.id;
        this.actor_id = this.model.actor_id;
        this.type = <MessageType>this.model.type;
        this.topic = this.model.topic;
        this.full_topic = `${this.producer.name}@${this.topic}`;
        this.status = this.model.status;
        this.is_health = this.model.is_health;
        this.data = this.model.data;
        this.job_id = this.model.job_id;
        this.updated_at = this.model.updated_at;
        this.created_at = this.model.created_at;
        this.subtask_total = this.model.subtask_total;
        this.pending_subtask_total = this.model.pending_subtask_total;
        this.clear_status = this.model.clear_status;
        // this.subtask_ids = this.model.subtask_ids;


        let parent_subtask_split = this.model.parent_subtask.split('@');
        if(parent_subtask_split.length > 0){
            this.parent_subtask_producer = this.producer.actorManager.getById(Number(parent_subtask_split[0]));
            this.parent_subtask_id = parent_subtask_split[1];
        }

        this.message_lock_key = `yimq:actor:${this.producer.id}:message:${this.id}:lock`;

    }

    async restore(messageModel){
        this.model = messageModel;
        await this.initProperties();
    };

    @OnDemand(OnDemandSwitch.MESSAGE_SUBTASKS)
    public async loadSubtasks() {

        let subtasks:Array<Subtask> = [];
        let subtaskModels = await this.database.SubtaskModel.find({message_id:this.id});
        for(var subtaskModel of subtaskModels){
            let subtask = await this.producer.subtaskManager.restoreByModel(this,subtaskModel);
            subtasks.push(subtask);
        }
        this.subtasks = subtasks;
        return this;
    }
    
    @OnDemand(OnDemandSwitch.MESSAGE_JOB)
    public async loadJob(){
        return this;
    }

    public async loadParentSubtask(){
        if(this.parent_subtask_id){
            this.parent_subtask = await this.producer.subtaskManager.get(this.parent_subtask_id);
        }
    }

    abstract  toDoing():Promise<CoordinatorProcessResult>;

    // protected async incrPendingSubtaskTotalAndLinkSubtask(redisMulti:IORedis.Pipeline,subtask:Subtask){

    //     redisMulti['message_link_subtask_id'](this.getMessageHash(),subtask.id)
    //     // redisMulti.hincrby(this.getMessageHash(),'subtask_total',1);
    //     // redisMulti.hincrby(this.getMessageHash(),'pending_subtask_total',1);
    
    // }
    // public getMessageHash(){
    //     // return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    // }

    setProperty(name,value){
        this[name] = value;
        // this.model.property(name,value);
        return this;
    }

    async setStatus(originStatus:MessageStatus,targetStatus:MessageStatus,session:ClientSession){
        let updatedResult = await this.database.MessageModel
            .findOneAndUpdate({_id: this.id,status: originStatus},{
                $set:{
                    status: targetStatus
                }
            },{session});

            if(!updatedResult){
                let updatedStatus = await this.getStatus();
                throw new BusinessException(`The message is in the ${updatedStatus} state and cannot be changed to ${targetStatus}`);
            }
            this.status = this.model.status = targetStatus;
    }

    async setStatusWithTransacation(originStatus:MessageStatus,targetStatus:MessageStatus,callback:TransactionCallback=null){
        let session = await this.database.connection.startSession();

        await session.withTransaction(async()=>{

            await this.setStatus(originStatus,targetStatus,session)
            callback && await callback(session)
        })
        await session.endSession();
    }

    async setStatusAndUpdate(redisClient:RedisClient|IORedis.Pipeline,status:MessageStatus){
        let updated_at = new Date().getTime();
        return await redisClient['setMessageStatus'](this.id,'updated_at',status,updated_at);
    }
    async save(){
        // this.model.property('updated_at',new Date().getTime());
        // return this.model.save();
    }
    async getStatus():Promise<MessageStatus>{
        let messageModel = await this.database.MessageModel.findById(this.id).select({status:1});
        return messageModel.status;
    }

    /**
     * 重写nohm后可以取消锁
     */
    // async lock(action,millisecond = 1000){
    //     let lockingAction = null;
    //     for(var i=0;i < 5; i++){
    //         var [lockingActionResult,lockResult] = await this.producer.redisClient
    //         .multi()
    //         .get(this.message_lock_key)
    //         .set(this.message_lock_key,action,"PX",millisecond,'NX')
    //         .exec()
    //         lockingAction = lockingActionResult[1] ? lockingActionResult[1]: lockingAction;
    //         if(lockResult[1] == 'OK'){
    //             i > 0 && Logger.warn(`Actor:${this.producer.id} message:${this.id} (${action}) get ${i} times lock by ${lockingAction}`,`Message`)
    //             return true;
    //         }
    //         await timeout(20);
    //     }
    //     throw new SystemException(`Message ${action} can't get the lock locked by ${lockingAction}.`)
    // }
    // async unlock(){
    //     return await this.producer.redisClient.del(this.message_lock_key);
    // }
    async healthCheck(){
        // let result = await this.producer.redisClient.messageHealthCheck(this.getMessageHash());
    }

    public async delete() {
        await this.loadSubtasks();
        for (const subtask of this.subtasks) {
            await subtask.delete();
        }
        await this.loadJob()
        this.job && await this.job.remove();   
        // await this.model.remove();
    }

    public async refresh(){
        this.model = await this.producer.messageManager.getMessageModel(this.id);
        await this.initProperties();
    }

}


export interface MessageControlResult{
    message:string
}