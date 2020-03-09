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
        this.job = await this.producer.jobManager.add(this,JobType.TRANSACTION,jobOptions);
        this.job_id = this.job.id;
        await this.update();
    };

 

    async abstract restore();

    async update():Promise<Message>{
        this.model.property('topic',this.topic);
        this.model.property('type',this.type);
        this.model.property('job_id',this.job_id);
        this.model.property('status',this.status);
        this.model.property('updated_at',new Date().getTime());
        await this.model.save();
        return this;
    }

    abstract async confirm():Promise<Message>;
    abstract async statusToDoing():Promise<Message>;
    abstract async statusToCancelling():Promise<Message>;

    abstract async cancel():Promise<Message>

     /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['actorManger'];
        json['producer'] = this.producer.name;
        json['job'] = this.job.toJson();
        return json;
    }
}