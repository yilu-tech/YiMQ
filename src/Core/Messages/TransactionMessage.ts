import { Message ,MessageControlResult} from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { SubtaskType } from "../../Constants/SubtaskConstants";
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import { BusinessException } from "../../Exceptions/BusinessException";
import { MessageJob } from "../Job/MessageJob";
import {JobStatus} from "../../Constants/JobConstants"
import { OnDemandFastToJson } from "../../Decorators/OnDemand";
import { Exclude } from "class-transformer";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { MessageOptions } from "../../Structures/MessageOptionsStructure";
import { timeout } from "../../Handlers";
import { SystemException } from "../../Exceptions/SystemException";
@Exclude()
export class TransactionMessage extends Message{
    type = MessageType.TRANSACTION;


    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        this.model.property('status',MessageStatus.PENDING);
        return this;
    }

    async toDoing():Promise<CoordinatorProcessResult>{
        if(!await this.lock('toDoing')){
            throw new SystemException('Message is locking can not to to doing');
        }
        try {
            
            await this.updatePendingSubtaskTotalAndSubtaskIds();

            //没有子任务直接完成message
            if(this.pending_subtask_total== 0){
                await this.setStatus(MessageStatus.DONE).save();
                return {result: 'success',desc:'not have subtask'};
            }
            await this.loadSubtasks();
            //并行执行
            await Promise.all(this.subtasks.map((subtask)=>{
                return subtask.confirm()
            }))

            await this.setStatus(MessageStatus.DOING).save();
            return {result: 'success'};
            
        } finally{
            await this.unlock();
        }
    }

    async toCancelling():Promise<CoordinatorProcessResult>{

        if(!await this.lock('toCancelling')){
            throw new SystemException('Message is locking can not to cancelling');
        }
        try {
             //没有子任务直接完成message
            if(this.pending_subtask_total == 0){
                await this.setStatus(MessageStatus.CANCELED).save();
                return {result: 'success'};
            }
            await this.loadSubtasks();

            await Promise.all(this.subtasks.map((subtask)=>{
                return subtask.cancel()
            }))
            await this.setStatus(MessageStatus.CANCELLING).save();
            return {result: 'success'};
            
        } finally{
            await this.unlock();
        }
    }

    async cancel():Promise<MessageControlResult>{
        let result:MessageControlResult=<MessageControlResult>{};
        await this.loadJob();
        if([MessageStatus.DOING,MessageStatus.DONE].includes(this.status)){
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }else if([MessageStatus.CANCELED,MessageStatus.CANCELLING].includes(this.status)){
            result.message = `Message already ${this.status}.`;
        }else if(await this.job.getStatus() != JobStatus.DELAYED ){
            result.message = `Message job status is ${await this.job.getStatus()} for timeout check.`;
        }else if([MessageStatus.PENDING,MessageStatus.PREPARED].includes(this.status)){
            await this.setStatus(MessageStatus.CANCELLING).save();
            await this.job.context.promote();//立即执行job
            result.message = 'success';
        }else{
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }
        return result;
    
    }

    async confirm():Promise<MessageControlResult>{
        let result:MessageControlResult=<MessageControlResult>{};
        await this.loadJob();
        if([MessageStatus.CANCELLING,MessageStatus.CANCELED].includes(this.status)){
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }
        else if([MessageStatus.DOING,MessageStatus.DONE].includes(this.status)){
            result.message = `Message already ${this.status}.`;
        }else if(await this.job.getStatus() != JobStatus.DELAYED ){
            result.message = `Message job status is ${await this.job.getStatus()} for timeout check.`;
        }else if([MessageStatus.PENDING,MessageStatus.PREPARED].includes(this.status)){
            await this.setStatus(MessageStatus.DOING).save();
            await this.job.context.promote();//立即执行job
            result.message = 'success';
        }else{
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }
        return result;
    }
    async prepare(body){
        if(this.status != MessageStatus.PENDING){//todo:: this.status改为从数据库实时获取
            throw new BusinessException(`The status of this message is ${this.status} instead of ${MessageStatus.PENDING}`);
        }
        let data = {
            id:  this.id,
            prepare_subtasks : []
        };
        if(body.prepare_subtasks && body.prepare_subtasks.length > 0 ){
            data.prepare_subtasks = await this.prepareSubtasks(body.prepare_subtasks);
        }
        await this.setStatus(MessageStatus.PREPARED).save();
        return data;   
    }
    private async prepareSubtasks(prepareSubtasksBody){
        let prepareSubtasksResult = [];
        for (const subtaskBody of prepareSubtasksBody) {
            let subtask:Subtask = await this.addSubtask(subtaskBody.type,subtaskBody);
            prepareSubtasksResult.push(OnDemandFastToJson(subtask));
        }
        return prepareSubtasksResult;
    }


    public async loadJob(){
        //this.job = await this.producer.jobManager.get(this.job_id,true); 不用这句的原因是，get会再去查一次this
        let jobContext = await this.producer.coordinator.getJob(this.job_id);
        this.job = new MessageJob(this,jobContext);
        await this.job.restore();
        return this;
    }

    async addSubtask(type,body){
        if(!await this.lock('addSubtask')){
            throw new SystemException('Message is locking can not add subtask');
        }


        try {

            if((await this.getStatus()) != MessageStatus.PENDING){//todo:: this.status改为从数据库实时获取
                throw new BusinessException(`The status of this message is ${this.status} instead of ${MessageStatus.PENDING}`);
            }
            body.subtask_id = await this.producer.actorManager.getSubtaskGlobalId();
            
            if(type == SubtaskType.BCST){
                body.consumer_id = this.producer.id
                body.processor = null; 
            }else{
                let {consumer,consumerProcessorName} = this.producer.subtaskManager.getConsumerAndProcessor(body.processor);
                body.consumer_id = consumer.id;
                body.processor = consumerProcessorName;
            }
            
            
            var subtask = await this.producer.subtaskManager.addSubtask(this,type,body);
            if(process.env.MOCK_TODONG_TOCANCING_AFTER_LINK_SUBTASK_WAIT_TIME){
                await timeout(Number(process.env.MOCK_TODONG_TOCANCING_AFTER_LINK_SUBTASK_WAIT_TIME));
            }
            await this.incrPendingSubtaskTotalAndLinkSubtask(subtask);
            this.subtasks.push(subtask);
            
        }finally{
            await this.unlock(); //tcc类子任务prepare时间可能过程，提前释放锁
        }

        return subtask.prepare();//try抛出错误的情况不会再prepare
    }

    public getMessageHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    async updatePendingSubtaskTotalAndSubtaskIds(){
        let [pending_subtask_total,subtask_ids] = await this.producer.redisClient.hmget(this.getMessageHash(),'pending_subtask_total','subtask_ids')
        this.pending_subtask_total = Number(pending_subtask_total);
        this.subtask_ids = JSON.parse(subtask_ids);
    }
}