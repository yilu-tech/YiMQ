import { MessageType } from '../Constants/MessageConstants';
import { Message, MessageControlResult } from './Messages/Message';
// import { GeneralMessage } from './Messages/GeneralMessage';
// import { TransactionMessage } from './Messages/TransactionMessage';
import { BusinessException } from '../Exceptions/BusinessException';
import { Actor } from './Actor';
import { SystemException } from '../Exceptions/SystemException';
// import { BroadcastMessage } from './Messages/BroadcastMessage';
import { MessageOptions } from '../Structures/MessageOptionsStructure';
import { ObjectId } from 'bson';
import { Database } from '../Database';
import { MessageModel } from '../Models/MessageModel';
export class MessageManager {
    private database:Database;
    /**
     * 不用动态引用的话，单元测试直接new class的时候时候会报错
     * TypeError: Class extends value undefined is not a constructor or null
     * 是因为循环引用导致的
     */
    messageClasses = {
        GeneralMessage: require("./Messages/GeneralMessage").GeneralMessage,
        TransactionMessage: require("./Messages/TransactionMessage").TransactionMessage,
        BroadcastMessage: require("./Messages/BroadcastMessage").BroadcastMessage,
    }
    constructor(private producer:Actor){
        this.database = producer.actorManager.application.database;
    }

    async create(type:MessageType, topic:string,data,options:MessageOptions):Promise<Message> {
       
        
        let message:Message = this.messageFactory(type,this.producer);
        await message.createMessageModel(topic,data,options);
        await (<Message>message).create(topic,options);//创建job
        return message;
    }
    async get(id):Promise<Message>{
        try{
            //TODO 这里要添加一个添加查询 producer.id  = message.producer_id
            // var messageModel = await this.producer.messageModel.load(id);
            var messageModel:MessageModel = await this.database.MessageModel.where({_id:id}).findOne();
            if(messageModel.actor_id != this.producer.id){
                throw new SystemException(`Message ${id} is not ${messageModel.actor_id} actor.`)
            }
        }catch(error){
            if(error && error.message === 'not found'){
                throw new BusinessException(`<${this.producer.name}> actor not found message by id=${id}.`);
            }
            throw error;
        }
        

        let message = this.messageFactory(messageModel.type,this.producer); 
        await (<Message>message).restore(messageModel);
        return message;
    }
    //todo:: 从messageManager中移除直接操作message
    async confirm(id):Promise<MessageControlResult>{
        let message:any =  await this.get(id);
        return message.confirm()
    }
    //todo:: 从messageManager中移除直接操作message
    async prepare(id,data):Promise<any>{
        let message:any = await this.get(id);
        return message.prepare(data)
    }
    //todo:: 从messageManager中移除直接操作message
    async cancel(id):Promise<MessageControlResult>{
        let message:any =  await this.get(id);
        return message.cancel()
    }
    //todo:: 从messageManager中移除直接操作message
    async addSubtask(id,type,body){
        let message:any=  await this.get(id);
        return message.addSubtask(type,body)

    }
    private messageFactory(type,producer):Message{
        let message;
        switch (type) {
            case MessageType.GENERAL:
                // message = new Messages.GeneralMessage(producer);
                message = new this.messageClasses.BroadcastMessage(producer);
                break;
            case MessageType.TRANSACTION:
                message = new this.messageClasses.TransactionMessage(producer);
                break;
            case MessageType.BROADCAST:
                message = new this.messageClasses.BroadcastMessage(producer);
                break;
            default:
                throw new BusinessException('MessageType is not exists.')
        }
        return message;
    }
    async getMessageModel(id){
        return await this.database.MessageModel.where({_id:id}).findOne();
    }
}