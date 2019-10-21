import { MessageType } from '../Constants/MessageConstants';
import { Message } from './Messages/Message';
import { GeneralMessage } from './Messages/GeneralMessage';
import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';

export class MessageManager {
    constructor(private producer:Actor){

    }

    async add<P>(type:MessageType, topic:string):Promise<P> {
        let message:any;
        switch (type) {
            case MessageType.GENERAL:
                message = new GeneralMessage();
                break;
            case MessageType.TRANSACTION:
                message = new TransactionMessage();
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
        (<Message>message).setProducer(this.producer);
        await (<Message>message).create(topic);
        return message;
    }
}