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
    public subtask_total:number;
    @Expose()
    public pending_subtask_total:number;

    @Expose()
    public clear_status:string;

    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public parent_subtask_producer:Actor;
    @Expose()
    public parent_subtask_id:string;

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
        let jobOptions:bull.JobOptions = {
            jobId: await this.producer.actorManager.getJobGlobalId(),
            delay: options.delay,
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
        this.subtask_contexts = <Array<SubtaskContext>>this.model.property('subtask_contexts');
        this.clear_status = this.model.property('clear_status');


        let parent_subtask_split = this.model.property('parent_subtask').split('@');
        if(parent_subtask_split.length > 0){
            this.parent_subtask_producer = this.producer.actorManager.getById(Number(parent_subtask_split[0]));
            this.parent_subtask_id = parent_subtask_split[1];
        }


    }

    async restore(messageModel){
        this.model = messageModel;
        await this.initProperties();
    };

    @OnDemand(OnDemandSwitch.MESSAGE_SUBTASKS)
    public  async loadSubtasks(full=false){
        return this;
    };
    @OnDemand(OnDemandSwitch.MESSAGE_JOB)
    public async loadJob(){
        return this;
    }

    abstract async toDoing():Promise<CoordinatorProcessResult>;

    protected async incrPendingSubtaskTotal(){
        let multi = this.producer.redisClient.multi();
        multi.hincrby(this.getMessageHash(),'subtask_total',1);
        multi.hincrby(this.getMessageHash(),'pending_subtask_total',1);
        await multi.exec();
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

    public async refresh(){
        this.model = await this.producer.messageModel.load(this.id);
        await this.initProperties();
    }

}


export interface MessageControlResult{
    message:string
}