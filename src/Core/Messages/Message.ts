import { Actor } from "../Actor";
import { MessageStatus, MessageType } from "../../Constants/MessageConstants";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { MessageModelClass } from "../../Models/MessageModel";
import * as bull from 'bull';
import { Subtask } from "../Subtask/BaseSubtask/Subtask";

export interface SubtaskContext{
    consumer_id:number
    processor:string
    subtask_id:number
}

export abstract class Message{
    id:string;
    actor_id:number;
    topic: string;
    full_topic:string;
    status: MessageStatus;
    data:any;
    job_id: number;
    updated_at: Number;
    created_at: Number;
    public type: MessageType; //普通消息，事物消息
    public producer:Actor;
    public job:Job;
    public model:MessageModelClass
    public subtask_contexts:Array<SubtaskContext>;
    public subtasks:Array<Subtask> = [];  //事物的子项目
    public pending_subtask_total:number;

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


    }

 

    async restore(messageModel){
        this.model = messageModel;
        await this.initProperties();
    };

    public abstract async loadSubtasks();

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
        await this.loadSubtasks();
        for (const subtask of this.subtasks) {
            await subtask.delete();
        }
        await this.model.remove();
    }

     /**
     * 整理数据
     */
    public toJson(full=false){
        let json:object = Object.assign({},this);
        delete json['actorManger'];
        delete json['model'];
        json['producer'] = this.producer.name;
        json['job'] = this.job.toJson(full);
        return json;
    }
}


export interface MessageControlResult{
    message:string
}