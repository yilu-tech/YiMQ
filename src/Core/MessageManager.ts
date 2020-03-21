import { MessageType, MessageStatus } from '../Constants/MessageConstants';
import { Message } from './Messages/Message';
import { GeneralMessage } from './Messages/GeneralMessage';
import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';
import * as bull from 'bull';
import { SystemException } from '../Exceptions/SystemException';
export class MessageManager {
    constructor(private producer:Actor){

    }

    async create<P>(type:MessageType, topic:string,jobOptions:bull.JobOptions={}):Promise<P> {
        let messageModel = new this.producer.messageModel();
        
        messageModel.id = String(await this.producer.actorManager.getMessageGlobalId());
        messageModel.property('id',messageModel.id);
        messageModel.property('actor_id',this.producer.id);
        messageModel.property('topic',topic);
        messageModel.property('type',type);
        messageModel.property('status',MessageStatus.PENDING);
        messageModel.property('created_at',new Date().getTime());
        await messageModel.save();
        
        let message:any = this.messageFactory(type,this.producer,messageModel)
        await (<Message>message).create(jobOptions);//创建job
        return message;
    }
    async get(id):Promise<any>{
        try{
            //TODO 这里要添加一个添加查询 producer.id  = message.producer_id
            var messageModel = await this.producer.messageModel.load(id);
        }catch(error){
            if(error && error.message === 'not found'){
                throw new BusinessException('Message not found');
            }
            throw new SystemException(error.message);
        }
        

        let message = this.messageFactory(messageModel.property('type'),this.producer,messageModel); 
        await (<Message>message).restore();
        return message;
    }

    async confirm(id):Promise<Message>{
        let message:Message = await this.get(id);
        return message.confirm()
    }
    async prepare(id,data):Promise<any>{
        let message:TransactionMessage = await this.get(id);
        return message.prepare(data)
    }
    async cancel(id):Promise<Message>{
        let message:Message = await this.get(id);
        return message.cancel()
    }
    async addSubtask(id,type,processserName,data){
        let message:TransactionMessage = await this.get(id);
        return message.addSubtask(type,processserName,data)

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