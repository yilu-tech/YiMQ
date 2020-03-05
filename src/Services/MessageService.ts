import { MessageType } from "../Constants/MessageConstants";
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { BusinessException } from "../Exceptions/BusinessException";
import * as bull from 'bull';
import { Message } from "../Core/Messages/Message";
@Injectable()
export class MessageService {
    constructor(private actorManger:ActorManager){

    }
    async create<P>(producerName:string,type:MessageType, topic:string,options?:bull.JobOptions):Promise<P> {
        let message:any;
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        message =  await producer.messageManager.create(type,topic,options);
        return message;
    }
    async confirm(producerName:string,messageId):Promise<Message>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.confirm(messageId);
    }
    async cancel(producerName:string,messageId){
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.cancel(messageId);
    }
    async addSubtask(producerName:string,messageId,subtaskBody:any):Promise<any>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.addSubtask(messageId,subtaskBody.type,subtaskBody.processerName,subtaskBody.data);
    }
}