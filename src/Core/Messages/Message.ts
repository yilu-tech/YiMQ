import { ActorManager } from "../ActorManager";
import { Actor } from "../Actor";
import { MessageStatus } from "../../Constants/MessageConstants";
import { Logger } from "@nestjs/common";
import { Job } from "../Job/Job";
import { JobType, JobAction } from "../../Constants/JobConstants";


export abstract class Message{
    id:string;
    topic: string;
    status: MessageStatus;
    created_at: Number;
    public type: Number; //普通消息，事物消息
    public producer:Actor;
    public job:Job;


    public setProducer(actor:Actor){
        this.producer = actor;
    }
    async create(topic:string):Promise<object>{
        let message = new this.producer.messageModel();
        message.property('topic',topic);
        message.property('status',MessageStatus.PENDING);
        message.property('created_at',new Date().getTime());
        await message.save();
        this.id = message.id;
        this.topic = message.property('topic');
        this.status = message.property('status');
        this.created_at = message.property('created_at');
        Logger.debug(this.toJson(),'Created Message')
        this.job = await this.producer.jobManager.add(this,JobType.TRANSACTION,JobAction.CHECK);
        Logger.debug(this.job.id,'Created Message Job')
        return this;
    };



     /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['actorManger'];
        json['producer'] = this.producer.name;
        return json;
    }
}