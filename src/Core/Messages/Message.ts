import { ActorManager } from "../ActorManager";
import { Actor } from "../Actor";
import { MessageStatus, MessageType } from "../../Constants/MessageConstants";
import { Logger } from "@nestjs/common";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { MessageModelClass } from "../../Models/Message";
import * as bull from 'bull';

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

    constructor(producer:Actor,messageModel){

        this.id = messageModel.id;
        this.actor_id = messageModel.property('actor_id');
        this.type = messageModel.property('type');
        this.topic = messageModel.property('topic');
        this.status = messageModel.property('status');
        this.job_id = messageModel.property('job_id')
        this.updated_at = messageModel.property('updated_at');
        this.created_at = messageModel.property('created_at');

        this.model = messageModel;
        this.producer = producer;
    }


    /**
     * 创建message对应的job
     * @param options 
     */
    async create(jobOptions:bull.JobOptions):Promise<any>{
        jobOptions.jobId = await this.producer.actorManager.getJobGlobalId();
        await this.setJobId(jobOptions.jobId).save();//先保存job_id，如果先创建job再保存id可能产生，message未记录job_id的情况
        this.job = await this.producer.jobManager.add(this,JobType.TRANSACTION,jobOptions);
    };

 

    async abstract restore();

    private setJobId(jobId){
        this.job_id = jobId;
        this.model.property('job_id',this.job_id);
        return this;
    }

    setStatus(status:MessageStatus){
        this.status = status;
        this.model.property('status',this.status);
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