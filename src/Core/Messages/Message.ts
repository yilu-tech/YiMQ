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
    public subtask_contexts:Array<SubtaskContext>;

    @Expose()
    public subtasks:Array<Subtask> = [];  //事物的子项目
    @Expose()
    public subtasks_total:number;
    @Expose()
    public pending_subtask_total:number;

    @Expose()
    public clear_status:string;

    constructor(producer:Actor){

        this.producer = producer;
    }

    async createMessageModel(topic,data){
        this.model = new this.producer.messageModel();
        
        this.model.id = String(await this.producer.actorManager.getMessageGlobalId());
        this.model.property('id',this.model.id);
        this.model.property('actor_id',this.producer.id);
        this.model.property('topic',topic);
        this.model.property('type',this.type);
        this.model.property('status',MessageStatus.PENDING);
        this.model.property('clear_status',MessageClearStatus.WAITING);
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
    async create(topic:string, jobOptions:bull.JobOptions):Promise<any>{
        jobOptions.jobId = await this.producer.actorManager.getJobGlobalId();
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
        this.pending_subtask_total = this.model.property('pending_subtask_total');
        this.subtask_contexts = <Array<SubtaskContext>>this.model.property('subtask_contexts');
        this.clear_status = this.model.property('clear_status');


    }

    async restore(messageModel){
        this.model = messageModel;
        await this.initProperties();
    };
    @OnDemand(OnDemandSwitch.MESSAGE_SUBTASKS_TOTAL)
    public async loadSubtasksTotal(){
        this.subtasks_total = await this.model.numLinks('subtask');
    }

    @OnDemand(OnDemandSwitch.MESSAGE_SUBTASKS)
    public  async loadSubtasks(full=false){
        return this;
    };

    public async loadJob(){
        return this;
    }

    abstract async toDoing():Promise<Message>;

    protected async incrPendingSubtaskTotal(){
        return this.producer.redisClient.hincrby(this.getMessageHash(),'pending_subtask_total',1);
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
    async save(){
        this.model.property('updated_at',new Date().getTime());
        return this.model.save();
    }
    async getStatus(){
        return this.status;
    }

    public async delete() {
        await this.loadSubtasks(true);
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