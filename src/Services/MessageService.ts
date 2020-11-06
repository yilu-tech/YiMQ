import { MessageType } from "../Constants/MessageConstants";
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { BusinessException } from "../Exceptions/BusinessException";
import * as bull from 'bull';
import { Message, MessageControlResult } from "../Core/Messages/Message";
import { SubtaskType } from "../Constants/SubtaskConstants";
import { SystemException } from "../Exceptions/SystemException";
import { MessagesDto } from "../Dto/AdminControllerDto";
import e = require("express");
import { TransactionMessage } from "../Core/Messages/TransactionMessage";
@Injectable()
export class MessageService {
    constructor(private actorManger:ActorManager){

    }
    async create<P>(producerName:string,type:MessageType, topic:string,data,jobOptions?:bull.JobOptions):Promise<P> {
        let message:any;
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        message =  await producer.messageManager.create(type,topic,data,jobOptions);
        return message;
    }
    async confirm(producerName:string,messageId):Promise<MessageControlResult>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        return producer.messageManager.confirm(messageId);
    }
    async prepare(producerName:string,messageId,data):Promise<any>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        return producer.messageManager.prepare(messageId,data);
    }
    async cancel(producerName:string,messageId){
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        return producer.messageManager.cancel(messageId);
    }
    async addSubtask(producerName:string,messageId,subtaskType:SubtaskType,body):Promise<any>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        return producer.messageManager.addSubtask(messageId,subtaskType,body);
    }

    async get(actor_id:number,message_id:number):Promise<any>{
        let producer = this.actorManger.getById(actor_id);
        if(!producer){
            throw new SystemException(`Actor <${actor_id}> not exists.`)
        }
        let message:TransactionMessage = await producer.messageManager.get(message_id,true);
        return message.toJson();
    }

    async list(actor_id:number,query:MessagesDto):Promise<any>{
        let producer = this.actorManger.getById(actor_id);
        let messages;
        if(query.message_id){
            messages = await this.findByMessageId(producer,query.message_id);
        }
        else if(query.topic){
            messages = await this.findByMessageId(producer,query.topic);
        }
        else{
            messages = await this.findAll(producer);
        }
        

        let messagesJson = messages.map((message) => {
            return message.allProperties();
         });
        return messagesJson;

       
    }
    private async findByMessageId(producer,message_id){
        return producer.messageModel.findAndLoad({
            id: message_id
        })
    }
    private async findByTopic(producer,topic){
        return producer.messageModel.findAndLoad({
            actor_id: producer.id,
            topic: topic
        })
    }
    private async findAll(producer){
        let PendingIds = await producer.messageModel.find({
            actor_id: producer.id,
            status: "PENDING",
        });
        let doingIds = await producer.messageModel.find({
            actor_id: producer.id,
            status: "DOING"
        });
        let ids = PendingIds.concat(doingIds);
        let sorIds = await producer.messageModel.sort({
            field:'id',
            direction: 'DESC',
            limit:[0,10]
        },ids);
        return await producer.messageModel.loadMany(sorIds);

    }
}