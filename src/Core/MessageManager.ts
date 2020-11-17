import { MessageType } from '../Constants/MessageConstants';
import { Message, MessageControlResult } from './Messages/Message';
import { GeneralMessage } from './Messages/GeneralMessage';
import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';
import { SystemException } from '../Exceptions/SystemException';
import { BroadcastMessage } from './Messages/BroadcastMessage';
import { JobsOptions } from 'bullmq';
export class MessageManager {
    constructor(private producer:Actor){

    }

    async create(type:MessageType, topic:string,data,jobOptions:JobsOptions={}):Promise<any> {
       
        
        let message:Message = this.messageFactory(type,this.producer);
        await message.createMessageModel(topic,data);
        await (<Message>message).create(topic,jobOptions);//创建job
        return message;
    }
    async get(id):Promise<any>{
        try{
            //TODO 这里要添加一个添加查询 producer.id  = message.producer_id
            var messageModel = await this.producer.messageModel.load(id);
            if(messageModel.property('actor_id') != this.producer.id){
                throw new SystemException(`Message ${id} is not ${messageModel.property('actor_id')} actor.`)
            }
        }catch(error){
            if(error && error.message === 'not found'){
                throw new BusinessException(`<${this.producer.name}> actor not found message by id=${id}.`);
            }
            throw error;
        }
        

        let message = this.messageFactory(messageModel.property('type'),this.producer); 
        await (<Message>message).restore(messageModel);
        return message;
    }

    async confirm(id):Promise<MessageControlResult>{
        let message = <TransactionMessage> await this.get(id);
        return message.confirm()
    }
    async prepare(id,data):Promise<any>{
        let message:TransactionMessage = await this.get(id);
        return message.prepare(data)
    }
    async cancel(id):Promise<MessageControlResult>{
        let message = <TransactionMessage> await this.get(id);
        return message.cancel()
    }
    async addSubtask(id,type,body){
        let message:TransactionMessage = await this.get(id);
        return message.addSubtask(type,body)

    }
    private messageFactory(type,producer):Message{
        let message;
        switch (type) {
            case MessageType.GENERAL:
                message = new GeneralMessage(producer);
                break;
            case MessageType.TRANSACTION:
                message = new TransactionMessage(producer);
                break;
            case MessageType.BROADCAST:
                message = new BroadcastMessage(producer);
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
        return message;
    }
}