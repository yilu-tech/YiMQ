import { MessageClearStatus, MessageStatus, MessageType } from "../Constants/MessageConstants";
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { MessageControlResult } from "../Core/Messages/Message";
import { SubtaskType } from "../Constants/SubtaskConstants";
import { SystemException } from "../Exceptions/SystemException";
import { isFullMessagesSearch, MessagesDto } from "../Dto/AdminControllerDto";
import e = require("express");
import { TransactionMessage } from "../Core/Messages/TransactionMessage";
import { ExposeGroups, OnDemandSwitch } from "../Constants/ToJsonConstants";
import { OnDemandRun, OnDemandToJson } from "../Decorators/OnDemand";
import { Actor } from "../Core/Actor";
import { intersectionBy, unionBy } from "lodash";
import { timestampToDateString } from "../Handlers";
import { MessageOptions } from "../Interfaces/MessageInterfaces";
@Injectable()
export class MessageService {
    constructor(private actorManger:ActorManager){

    }
    async create<P>(producerName:string,type:MessageType, topic:string,data,options?:MessageOptions):Promise<P> {
        let message:any;
        let producer = this.actorManger.get(producerName);
        if(!producer){
            throw new SystemException(`Producer <${producerName}> not exists.`)
        }
        message =  await producer.messageManager.create(type,topic,data,options);
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
        let message = <TransactionMessage>await producer.messageManager.get(message_id);

        await OnDemandRun(message,[
            OnDemandSwitch.MESSAGE_JOB,
            OnDemandSwitch.MESSAGE_SUBTASKS,
            OnDemandSwitch.SUBTASK_JOB,
            OnDemandSwitch.SUBTASK_CHILDREN,
            OnDemandSwitch.JOB_STATUS
        ],3)
        let result = OnDemandToJson(message,[
            ExposeGroups.MESSAGE_JOB,
            ExposeGroups.RELATION_ACTOR,
            ExposeGroups.SUBTASK_JOB,
            ExposeGroups.JOB_FULL,
        ])
        return result;
    }

    async search(actor_id:number,conditions:MessagesDto):Promise<any>{
        let producer = this.actorManger.getById(actor_id);
        if(!producer){
            throw new SystemException(`Producer <${actor_id}> not exists.`)
        }

        let result;
        if(isFullMessagesSearch(conditions)){
            result =  await this.findAll(producer,conditions);
        }else{
            result = await this.findByConditions(producer,conditions);
        }
        return result;
    }

    private async findAll(producer:Actor,conditions:MessagesDto){
        let ids = await producer.messageModel.find({
            actor_id: producer.id
        })
        return await this.sortAndLoadMessage(producer,conditions,ids);
    }

    private async findByConditions(producer,conditions:MessagesDto){
        let ids = [];

        if(conditions.message_id){
            ids = unionBy(ids,await this.findByMessageId(producer,conditions.message_id),String);
        }

        if(conditions.topic){
            ids = unionBy(ids,await this.findByTopic(producer,conditions.topic),String);
        }

        if(conditions.subtask_id){
            ids = unionBy(ids,await this.findBySubtask(producer,conditions.subtask_id),String);
        }

        if (conditions.job_id){
            ids = unionBy(ids,await this.findByJob(producer,conditions.job_id),String);
        }    

        if(conditions.clear_status){
            let clearStatusResultIds = await this.findByMessageClearStatus(producer,conditions.clear_status);
            ids = ids.length > 0  ? intersectionBy(ids,clearStatusResultIds,String) : clearStatusResultIds;
        }

        else if(conditions.status && conditions.status.length > 0){
            let statusResultIds = await this.findByMessageStatus(producer,conditions.status);
            ids = ids.length > 0  ? intersectionBy(ids,statusResultIds,String) : statusResultIds;
        }

        return await this.sortAndLoadMessage(producer,conditions,ids);
    }

    public async sortAndLoadMessage(producer,conditions:MessagesDto,ids){
        let sorIds = await producer.messageModel.sort({
            field:'id',
            direction: conditions.sort,
            limit:[Number(conditions.start),Number(conditions.size)]
        },ids);
        let messages = this.findResultToJson(await producer.messageModel.loadMany(sorIds));
        for (const message of messages) {
            message.created_at = timestampToDateString(parseInt(message.created_at))
            message.updated_at = timestampToDateString(parseInt(message.updated_at))
        }
        return {
            total: ids.length,
            start: conditions.start,
            size: conditions.size,
            sort: conditions.sort, 
            messages:messages,
        };
    }
    private async findByMessageId(producer,message_id){
        return producer.messageModel.find({
            actor_id: producer.id,
            id: message_id
        })
    }

    private async findByMessageClearStatus(producer:Actor,clearStatus:MessageClearStatus){
        let doneIds =  await producer.messageModel.find({
            actor_id: producer.id,
            status: MessageStatus.DONE,
            clear_status: clearStatus
        })
        let canceledIds =  await producer.messageModel.find({
            actor_id: producer.id,
            status: MessageStatus.CANCELED,
            clear_status: clearStatus
        })
        return doneIds.concat(canceledIds);
    }

    private async findByMessageStatus(producer:Actor,status:MessageStatus[]){
        let ids = []
        for (const item of status) {
            let message_ids = await producer.messageModel.find({
                actor_id: producer.id,
                status: item
            })
            ids = ids.concat(message_ids);
        }
        return ids;
    }
    private async findByTopic(producer,topic){
        return producer.messageModel.find({
            actor_id: producer.id,
            topic: topic
        })
    }

    private async findBySubtask(producer:Actor,subtask_id){
        let ids = []
        try {
            let subtaskModel = await producer.subtaskModel.load(subtask_id); 
            if(subtaskModel){
                ids = [subtaskModel.property('message_id')];
            }
        } catch (error) {
            if(error.message != 'not found') throw error;
        }finally{
            return ids;  
        }
    }
    private async findByJob(producer:Actor,job_id){
        let messageIds = await producer.messageModel.find({
            actor_id: producer.id,
            job_id: job_id
        })

        let subtaskModels = await producer.subtaskModel.findAndLoad({
            producer_id: producer.id,
            job_id: job_id
        })
        let subtaskMessageIds = subtaskModels.map((subtaskModel)=>{
            return subtaskModel.property('message_id');
        })

        return unionBy(messageIds,subtaskMessageIds,String);

    }

    private findResultToJson(messagesModel){
        return messagesModel.map((message) => {
            return message.allProperties();
        });
    }
}