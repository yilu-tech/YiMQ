import { Actor } from "../Actor";
import { MessageStatus, MessageType, MessageClearStatus } from "../../Constants/MessageConstants";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { MessageModelClass } from "../../Models/MessageModel";
import * as bull from 'bull';
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import {  Expose, Transform } from "class-transformer";
import { format } from "date-fns";
import {  ExposeGroups, OnDemandSwitch } from "../../Constants/ToJsonConstants";
import { OnDemand } from "../../Decorators/OnDemand";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { MessageOptions } from "../../Structures/MessageOptionsStructure";
import { SystemException } from "../../Exceptions/SystemException";
import { timeout } from "../../Handlers";
import { Logger } from "@nestjs/common";
import { lowerCase } from "lodash";
import { RedisClient } from "../../Handlers/redis/RedisClient";
import IORedis from "ioredis";

export interface SubtaskContext{
    consumer_id:number
    processor:string
    subtask_id:number
}

export abstract class Message{
    @Expose()
    id:string;

    @Expose()
    actor_id:number;

    @Expose()
    topic: string;

    @Expose()
    full_topic:string;

    @Expose()
    status: MessageStatus;

    @Expose()
    data:any;

    @Expose()
    job_id: number;

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
    public model:MessageModelClass

    @Expose()
    public subtask_ids:string[];

    @Expose()
    public subtasks:Array<Subtask> = [];  //事物的子项目
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
    }

    async createMessageModel(topic,data,options:MessageOptions){
        this.model = new this.producer.messageModel();
        
        this.model.id = String(await this.producer.actorManager.getMessageGlobalId());
        this.model.property('id',this.model.id);
        this.model.property('actor_id',this.producer.id);
        this.model.property('topic',topic);
        this.model.property('type',this.type);
        this.model.property('status',MessageStatus.PENDING);
        this.model.property('clear_status',MessageClearStatus.WAITING);

        if(options.parent_subtask){
            let parent_subtask_info = options.parent_subtask.split('@');
            let producer = this.producer.actorManager.get(parent_subtask_info[0]);
            if(!producer){
                throw new SystemException(`producer not exist of parent_subtask ${options.parent_subtask}.`)
            }
            let parent_subtask = `${producer.id}@${parent_subtask_info[1]}`;
            this.model.property('parent_subtask',parent_subtask)
        }else{
            this.model.property('parent_subtask','-1')
        }

        if(data){
            this.model.property('data',data)
        }
        
        this.model.property('created_at',new Date().getTime());
        return this;
    }


    /**
     * 创建message对应的job
     * @param options 
     */
    async create(topic:string, options:MessageOptions):Promise<any>{
       
        let delay = options.delay ? options.delay : this.producer.actorManager.config.options[`${lowerCase(this.type)}_message_delay`];
        let jobOptions:bull.JobOptions = {
            jobId: await this.producer.actorManager.getJobGlobalId(),
            delay: delay,
            backoff: options.backoff
        };
        this.model.property('job_id',jobOptions.jobId);//先保存job_id，如果先创建job再保存id可能产生，message未记录job_id的情况
        await this.save();
        await this.initProperties();
        this.job = await this.producer.jobManager.add(this,JobType.MESSAGE,jobOptions);//TODO JobType.TRANSACTION -> JobType.MESSAGE
        return this;
    };

    async initProperties(){
        this.id = this.model.id;
        this.actor_id = this.model.property('actor_id');
        this.type = <MessageType>this.model.property('type');
        this.topic = this.model.property('topic');
        this.full_topic = `${this.producer.name}@${this.topic}`;
        this.status = this.model.property('status');
        this.data = this.model.property('data');
        this.job_id = this.model.property('job_id')
        this.updated_at = this.model.property('updated_at');
        this.created_at = this.model.property('created_at');
        this.subtask_total = this.model.property('subtask_total');
        this.pending_subtask_total = this.model.property('pending_subtask_total');
        this.clear_status = this.model.property('clear_status');
        this.subtask_ids = this.model.property('subtask_ids');


        let parent_subtask_split = this.model.property('parent_subtask').split('@');
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
        for(var subtask_id of this.subtask_ids){
            let subtask = await this.producer.subtaskManager.getByMessage(this,subtask_id);
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

    abstract async toDoing():Promise<CoordinatorProcessResult>;

    protected async incrPendingSubtaskTotalAndLinkSubtask(subtask:Subtask){
        let multi = this.producer.redisClient.multi();
        multi['message_link_subtask_id'](this.getMessageHash(),subtask.id)
        multi.hincrby(this.getMessageHash(),'subtask_total',1);
        multi.hincrby(this.getMessageHash(),'pending_subtask_total',1);
        let result = await multi.exec();
    
    }
    public getMessageHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }

    setProperty(name,value){
        this[name] = value;
        this.model.property(name,value);
        return this;
    }

    setStatus(status:MessageStatus){
        this.model.property('status',status);
        this.status = status;
        return this;
    }

    async setStatusAndUpdate(redisClient:RedisClient|IORedis.Pipeline,status:MessageStatus){
        let updated_at = new Date().getTime();
        return await redisClient['setMessageStatus'](this.id,'updated_at',status,updated_at);
    }
    async save(){
        this.model.property('updated_at',new Date().getTime());
        return this.model.save();
    }
    async getStatus(){
        // return this.status;
        // return await this.message.producer.redisClient.hget(this.getDbHash(),'status');
        return await this.producer.redisClient.hget(this.getMessageHash(),'status');
    }

    /**
     * 重写nohm后可以取消锁
     */
    async lock(action){
        let millisecond = 200;
        let lockAction = await this.producer.redisClient.get(this.message_lock_key);
        for(var i=0;i < 5; i++){
            let lock = await this.producer.redisClient.set(this.message_lock_key,action,"PX",millisecond,'NX');
            if(lock){
                i > 0 && Logger.warn(`Actor:${this.producer.id} message:${this.id} (${action}) get ${i} times lock by ${lockAction}`,`Message`)
                return true;
            }
            await timeout(20);
        }
        
        Logger.warn(`Actor:${this.producer.id} message:${this.id} (${action}) get ${i} times failed lock by ${lockAction}`,`Message`)
       
        return false;
    }
    async unlock(){
        return await this.producer.redisClient.del(this.message_lock_key);
    }

    public async delete() {
        await this.loadSubtasks();
        for (const subtask of this.subtasks) {
            await subtask.delete();
        }
        await this.loadJob()
        this.job && await this.job.remove();   
        await this.model.remove();
    }

}


export interface MessageControlResult{
    message:string
}