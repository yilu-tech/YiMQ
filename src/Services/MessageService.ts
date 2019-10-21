import { MessageType } from "../Constants/MessageConstants";
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { BusinessException } from "../Exceptions/BusinessException";
@Injectable()
export class MessageService {
    constructor(private actorManger:ActorManager){

    }
    async create<P>(producerName:string,type:MessageType, topic:string):Promise<P> {
        let message:any;
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new BusinessException('Producer not exists.')
        }
        message =  await producer.messageManager.add(type,topic);
        return message;
    }
}