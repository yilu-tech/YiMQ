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
import IORedis from "ioredis";
@Exclude()
export class TransactionMessage extends Message{
    type = MessageType.TRANSACTION;


    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        this.model.property('status',MessageStatus.PENDING);
        return this;
    }

    async toDoing():Promise<CoordinatorProcessResult>{
        await this.updatePendingSubtaskTotalAndSubtaskIds();//锁住后再查询 剩余子任务数量(可以写到脚本中连判断带 message的状态改变)

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
        return {result: 'success'};
    }

    async toCancelling():Promise<CoordinatorProcessResult>{
        await this.updatePendingSubtaskTotalAndSubtaskIds();
        //没有子任务直接完成message
        if(this.pending_subtask_total == 0){
            await this.setStatus(MessageStatus.CANCELED).save();
            return {result: 'success'};
        }
        await this.loadSubtasks();

        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.cancel()
        }))
        return {result: 'success'};
    }

    async cancel():Promise<MessageControlResult>{

        await this.lock('cancel')
        
        try{
           let result:MessageControlResult=<MessageControlResult>{};
            await this.loadJob();
            let status = await this.getStatus();

            if([MessageStatus.DOING,MessageStatus.DONE].includes(status)){
                throw new BusinessException(`The status of this message is ${status}.`);
            }else if([MessageStatus.CANCELED,MessageStatus.CANCELLING].includes(status)){
                result.message = `Message already ${status}.`;
            }else if(await this.job.getStatus() != JobStatus.DELAYED ){
                result.message = `Message job status is ${await this.job.getStatus()} for timeout check.`;
            }else if([MessageStatus.PENDING,MessageStatus.PREPARED].includes(status)){
                await this.setStatus(MessageStatus.CANCELLING).save();
                await this.job.context.promote();//立即执行job
                result.message = 'success';
            }else{
                throw new BusinessException(`The status of this message is ${status}.`);
            }
            return result;
       }finally{
           await this.unlock();
       }
    }

    async confirm():Promise<MessageControlResult>{
        await this.lock('confirm')
        try{
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
        }finally{
            await this.unlock();
        }
    }
    async prepare(body){

        await this.lock('prepare',2000)

        try {
            let status = await this.getStatus();
            if(status != MessageStatus.PENDING){//todo:: this.status改为从数据库实时获取
                throw new BusinessException(`The status of this message is ${status}.`);
            }
            let data = {
                id:  this.id,
                prepare_subtasks : []
            };
            if(body.prepare_subtasks && body.prepare_subtasks.length > 0 ){
                var subtasks = await this.createSubtasks(body.prepare_subtasks);
                data.prepare_subtasks = await this.prepareSubtasks(subtasks);//create 和 prepare虽然不在一个事务，但是preapre失败报错导致本地回滚，不会存在事务问题
            }
            await this.setStatus(MessageStatus.PREPARED).save();
            return data;  
            
        }finally{
            await this.unlock(); 
        }
   
    }
    private async createSubtasks(prepareSubtasksBody){
        let subtasks:Subtask[] = [];
        let redisMulti = this.producer.redisClient.multi();
        for (const subtaskBody of prepareSubtasksBody) {
            // let subtask:Subtask = await this.addSubtask(subtaskBody.type,subtaskBody);
            let subtask:Subtask = await this.createSubtask(redisMulti,subtaskBody.type,subtaskBody);
            subtasks.push(subtask);
        }
        await redisMulti.exec()//todo: 判断结果
        return subtasks;
    }

    public async prepareSubtasks(subtasks){
        let prepareSubtasksResult = [];
        for (const subtask of subtasks) {
            await subtask.prepare()
            prepareSubtasksResult.push(OnDemandFastToJson(subtask));
        }
        return prepareSubtasksResult;
    }


    public async loadJob(){
        let jobContext = await this.producer.coordinator.getJob(this.job_id);
        this.job = new MessageJob(this,jobContext);
        await this.job.restore();
        return this;
    }

    async addSubtask(type,body){
        await this.lock('addSubtask')

        try {
            let status = await this.getStatus();
            if(status != MessageStatus.PENDING){//锁住message,获取状态再判断
                throw new BusinessException(`The message status is already ${status}`);
            }
            let redisMulti = this.producer.redisClient.multi();
            var subtask = await this.createSubtask(redisMulti,type,body);
            await redisMulti.exec();//todo判断结果
    
            this.subtasks.push(subtask);
            
        }finally{
            await this.unlock(); //tcc类子任务prepare时间可能过程，提前释放锁
        }
        await subtask.prepare();//try抛出错误的情况不会再prepare
        return subtask;
    }

    async createSubtask(redisMulti:IORedis.Pipeline,type,body){
        body.subtask_id = await this.producer.actorManager.getSubtaskGlobalId();
            
        if(type == SubtaskType.BCST){
            body.consumer_id = this.producer.id
            body.processor = null; 
        }else{
            let {consumer,consumerProcessorName} = this.producer.subtaskManager.getConsumerAndProcessor(body.processor);
            body.consumer_id = consumer.id;
            body.processor = consumerProcessorName;
        }
        
        
        var subtask = await this.producer.subtaskManager.addSubtask(redisMulti,this,type,body);
        await this.incrPendingSubtaskTotalAndLinkSubtask(redisMulti,subtask);
        return subtask;
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