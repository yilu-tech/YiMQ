import { MessageType } from '../Constants/MessageConstants';
import { Message } from './Messages/Message';
import { GeneralMessage } from './Messages/GeneralMessage';
import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';
import * as bull from 'bull';
export class MessageManager {
    constructor(private producer:Actor){

    }

    async add<P>(type:MessageType, topic:string,options?:bull.JobOptions):Promise<P> {
        let message:any;
        switch (type) {
            case MessageType.GENERAL:
                message = new GeneralMessage(MessageType.GENERAL);
                break;
            case MessageType.TRANSACTION:
                message = new TransactionMessage(MessageType.TRANSACTION);
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
        await (<Message>message).create(this.producer,topic,options);
        return message;
    }
    async get(id):Promise<Message>{
        let messageModel = await this.producer.messageModel.load(id);
        let message:any;
        switch (messageModel.property('type')) {
            case MessageType.GENERAL:
                message = new GeneralMessage(MessageType.GENERAL);
                break;
            case MessageType.TRANSACTION:
                message = new TransactionMessage(MessageType.TRANSACTION);
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
       return await (<Message>message).restore(this.producer,messageModel.allProperties());
    }
}