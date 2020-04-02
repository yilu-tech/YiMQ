import { ActorManager } from "../ActorManager";
import { Actor } from "../Actor";
import { MessageStatus, MessageType } from "../../Constants/MessageConstants";
import { Logger } from "@nestjs/common";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { MessageModelClass } from "../../Models/Message";
import * as bull from 'bull';
import { Subtask } from "../Subtask/BaseSubtask/Subtask";

export abstract class Message{
    id:string;
    actor_id:number;
    topic: string;
    status: MessageStatus;
    job_id: number;
    updated_at: Number;
    created_at: Number;
    public type: MessageType; //普通消息，事物消息
    public producer:Actor;
    public job:Job;
    public model:MessageModelClass

    public subtasks:Array<Subtask> = [];  //事物的子项目
    public pending_subtask_total:number;

    constructor(producer:Actor){

        this.producer = producer;
    }

    async createMessageModel(topic:string){
        let messageModel = new this.producer.messageModel();
        
        messageModel.id = String(await this.producer.actorManager.getMessageGlobalId());
        messageModel.property('id',messageModel.id);
        messageModel.property('actor_id',this.producer.id);
        messageModel.property('topic',topic);
        messageModel.property('type',this.type);
        messageModel.property('status',MessageStatus.PENDING);
        messageModel.property('created_at',new Date().getTime());
        return messageModel;
    }


    /**
     * 创建message对应的job
     * @param options 
     */
    async create(topic:string, jobOptions:bull.JobOptions):Promise<any>{
        let messageModel = await this.createMessageModel(topic);

        jobOptions.jobId = await this.producer.actorManager.getJobGlobalId();
        messageModel.property('job_id',jobOptions.jobId);//先保存job_id，如果先创建job再保存id可能产生，message未记录job_id的情况
        await messageModel.save();
        await this.initProperties(messageModel);
        this.job = await this.producer.jobManager.add(this,JobType.TRANSACTION,jobOptions);//TODO JobType.TRANSACTION -> JobType.MESSAGE
        return this;
    };

    async initProperties(messageModel){
        this.id = messageModel.id;
        this.actor_id = messageModel.property('actor_id');
        this.type = messageModel.property('type');
        this.topic = messageModel.property('topic');
        this.status = messageModel.property('status');
        this.job_id = messageModel.property('job_id')
        this.updated_at = messageModel.property('updated_at');
        this.created_at = messageModel.property('created_at');
        this.pending_subtask_total = messageModel.property('pending_subtask_total');

        this.model = messageModel;
    }

 

    async restore(messageModel){
        await this.initProperties(messageModel);
    };

    abstract async toDoing():Promise<Message>;

    setStatus(status:MessageStatus){
        this.model.property('status',status);
        this.status = status;
        return this;
    }
    async save(){
        return this.model.save();
    }
    async getStatus(){
        return this.status;
    }

    abstract async confirm():Promise<MessageControlResult>;

    abstract async cancel():Promise<MessageControlResult>

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