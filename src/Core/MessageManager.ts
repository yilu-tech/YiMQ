import { MessageType, MessageStatus } from '../Constants/MessageConstants';
import { Message } from './Messages/Message';
import { GeneralMessage } from './Messages/GeneralMessage';
import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';
import * as bull from 'bull';
export class MessageManager {
    constructor(private producer:Actor){

    }

    async create<P>(type:MessageType, topic:string,options?:bull.JobOptions):Promise<P> {
        let messageModel = new this.producer.messageModel();
        
        messageModel.property('topic',topic);
        messageModel.property('type',type);
        messageModel.property('status',MessageStatus.PENDING);
        messageModel.property('created_at',new Date().getTime());
        await messageModel.save();
        
        let message:any = this.messageFactory(type,this.producer,messageModel)
        await (<Message>message).create(options);
       
        return message;
    }
    async get(id):Promise<any>{
        let messageModel = await this.producer.messageModel.load(id);
        let message = this.messageFactory(messageModel.property('type'),this.producer,messageModel); 
        await (<Message>message).restore();
        return message;
    }

    async confirm(id):Promise<Message>{
        let message = await this.get(id);
        return message.confirm()
    }
    async cancel(id):Promise<Message>{
        let message = await this.get(id);
        return message.cancel()
    }
    async addSubtask(id,subtaskData){
        // let message:TransactionMessage = await this.get(id);
        // await message.addSubtask(subtaskData)

    }
    private messageFactory(type,producer,messageModel):Message{
        let message;
        switch (type) {
            case MessageType.GENERAL:
                message = new GeneralMessage(producer,messageModel);
                break;
            case MessageType.TRANSACTION:
                message = new TransactionMessage(producer,messageModel);
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
        return message;
    }
}