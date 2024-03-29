import { Message ,MessageControlResult} from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { SubtaskType } from "../../Constants/SubtaskConstants";
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import { BusinessException } from "../../Exceptions/BusinessException";
import { SubtaskModelClass } from "../../Models/SubtaskModel"
import { MessageJob } from "../Job/MessageJob";
import {JobStatus} from "../../Constants/JobConstants"
import { OnDemandFastToJson } from "../../Decorators/OnDemand";
import { Exclude } from "class-transformer";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { MessageOptions } from "../../Structures/MessageOptionsStructure";
import {AppLogger} from '../../Handlers/AppLogger';
@Exclude()
export class TransactionMessage extends Message{
    type = MessageType.TRANSACTION;


    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        this.model.property('status',MessageStatus.PENDING);
        return this;
    }

    async toDoing():Promise<CoordinatorProcessResult>{
        //没有子任务直接完成message
        let pending_subtask_total = await this.getPendingSubtaskTotal();
        if(pending_subtask_total== 0){
            await this.setStatus(MessageStatus.DONE).save();
            return {process: 'success'};
        }
        await this.loadSubtasks();
        //并行执行
        //TODO 增加防重复执行，导致重复给subtask添加任务,其中一个创建失败，再次尝试的时候，要避免已经成功的重复创建
        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.confirm()
        }))

        await this.setStatus(MessageStatus.DOING).save();
        return {process: 'success'};
        
    }

    async toCancelling():Promise<CoordinatorProcessResult>{
        //没有子任务直接完成message
        let pending_subtask_total = await this.getPendingSubtaskTotal();
        if(pending_subtask_total == 0){
            await this.setStatus(MessageStatus.CANCELED).save();
            return {process: 'success'};
        }
        await this.loadSubtasks();

        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.cancel()
        }))
        await this.setStatus(MessageStatus.CANCELLING).save();
        return {process: 'success'};
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
        if(jobContext){
            this.job = new MessageJob(this,jobContext);
            await this.job.restore();
        }else{
            AppLogger.error(`message:${this.id} job not found job:${this.job_id}`)
        }
        return this;
    }

    public async loadSubtasks(full=false){
        let subtaskIds = await this.model.getAll(SubtaskModelClass.modelName)
        let subtaskModels = await this.producer.subtaskModel.loadMany(subtaskIds)
        let subtasks:Array<Subtask> = [];
        for(var i in subtaskModels){
            let subtaskModel = subtaskModels[i];
            let subtask:Subtask = this.producer.subtaskManager.factory(this,subtaskModel.property('type'));//TODO use sutaskmanager methdo
            await subtask.restore(subtaskModel,full)
            subtasks.push(subtask);
        }
        this.subtasks = subtasks;
        return this;
        
    }

    async addSubtask(type,body){
        if(this.status != MessageStatus.PENDING){//todo:: this.status改为从数据库实时获取
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
        
        
        let subtask = await this.producer.subtaskManager.addSubtask(this,type,body);
        this.model.link(subtask.model);
        await this.model.save()
        await this.incrPendingSubtaskTotal();
        this.subtasks.push(subtask);
        return subtask.prepare();
    }

    public getMessageHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    async getPendingSubtaskTotal(){
        return Number(await this.producer.redisClient.hget(this.getMessageHash(),'pending_subtask_total'));
    }
}