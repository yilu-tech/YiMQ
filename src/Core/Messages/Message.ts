import { ActorManager } from "../ActorManager";
import { Actor } from "../Actor";
import { MessageStatus, MessageType } from "../../Constants/MessageConstants";
import { Logger } from "@nestjs/common";
import { Job } from "../Job/Job";
import { JobType, JobAction } from "../../Constants/JobConstants";
import { MessageModelClass } from "../../Models/Message";
import * as bull from 'bull';

export abstract class Message{
    id:string;
    topic: string;
    status: MessageStatus;
    created_at: Number;
    public type: MessageType; //普通消息，事物消息
    public producer:Actor;
    public job:Job;

    constructor(type:MessageType){
        this.type = type;
    }



    async create(producer:Actor,topic:string,options:bull.JobOptions):Promise<object>{
        this.producer = producer;
        let message = new this.producer.messageModel();
        message.property('topic',topic);
        message.property('type',this.type);
        message.property('status',MessageStatus.PENDING);
        message.property('created_at',new Date().getTime());
        await message.save();
        this.id = message.id;
        this.topic = message.property('topic');
        this.status = message.property('status');
        this.created_at = message.property('created_at');
        Logger.debug(this.id,'Created Message')
        this.job = await this.producer.jobManager.add(this,JobType.TRANSACTION,JobAction.CHECK,options);
        Logger.debug(this.job.id,'Created Message Job')
        return this;
    };
    async restore(producer:Actor,messageModel):Promise<Message>{
        this.producer = producer;
        this.id = messageModel.id;
        this.type = messageModel.type;
        this.topic = messageModel.topic;
        this.status = messageModel.status;
        this.created_at = messageModel.created_at;
        return this;
    }

    abstract async done()

    abstract async cancel()

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