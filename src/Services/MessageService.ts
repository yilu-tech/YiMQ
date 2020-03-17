import { MessageType } from "../Constants/MessageConstants";
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { BusinessException } from "../Exceptions/BusinessException";
import * as bull from 'bull';
import { Message } from "../Core/Messages/Message";
import { SubtaskType } from "../Constants/SubtaskConstants";
@Injectable()
export class MessageService {
    constructor(private actorManger:ActorManager){

    }
    async create<P>(producerName:string,type:MessageType, topic:string,jobOptions?:bull.JobOptions):Promise<P> {
        let message:any;
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        message =  await producer.messageManager.create(type,topic,jobOptions);
        return message;
    }
    async confirm(producerName:string,messageId):Promise<Message>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.confirm(messageId);
    }
    async prepare(producerName:string,messageId,data):Promise<any>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.prepare(messageId,data);
    }
    async cancel(producerName:string,messageId){
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.cancel(messageId);
    }
    async addSubtask(producerName:string,messageId,subtaskType:SubtaskType,processer,subtaskData:any):Promise<any>{
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        return producer.messageManager.addSubtask(messageId,subtaskType,processer,subtaskData);
    }
}