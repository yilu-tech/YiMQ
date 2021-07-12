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
import IORedis from "ioredis";
import { MessageOptions } from "../../Interfaces/MessageInterfaces";
import { ClientSession } from "mongoose";
import { TccSubtask } from "../Subtask/TccSubtask";
@Exclude()
export class TransactionMessage extends Message{
    type = MessageType.TRANSACTION;


    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        // this.model.property('status',MessageStatus.PENDING);
        this.model.status = MessageStatus.PENDING;
        return this;
    }

    async toDoing():Promise<CoordinatorProcessResult>{


        if(this.status != MessageStatus.DOING){
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }
        //没有子任务直接完成message
        /**
         * ?: 考虑是否用findOneUpdate({_id:id,pending_subtask_total:0})来进行判断和修改状态,
         * 这种方式每次会多一次数据库查询。
         * 状态为doning状态时，pending_subtask_total 绝对不会变动，可以直接判断
         */
        if(this.pending_subtask_total== 0){ 
            await this.setStatusWithTransacation(MessageStatus.DOING,MessageStatus.DONE,null);
            return {result: 'success',desc:'not have subtask'};
        }
        //TODO 工作到这里
        await this.loadSubtasks();
        //并行执行
        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.confirm()
        }))
        return {result: 'success'};
    }

    async toCancelling():Promise<CoordinatorProcessResult>{

        if(this.status != MessageStatus.CANCELLING){
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }

        //没有子任务直接完成message
        if(this.pending_subtask_total == 0){
            await this.setStatusWithTransacation(MessageStatus.CANCELLING,MessageStatus.CANCELED,null);
            return {result: 'success',desc:'not have subtask'};
        }
        await this.loadSubtasks();

        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.cancel()
        }))
        return {result: 'success'};
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

            // await this.setStatusWithTransacation(this.status,MessageStatus.CANCELLING,async (session)=>{
            //     await this.job.promote(session);//立即执行job
            // })
            result.message = 'success';
            await this.job.promote(async(session)=>{
                await this.setStatus(this.status,MessageStatus.CANCELLING,session);
            })
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

            // await this.setStatusWithTransacation(this.status,MessageStatus.DOING,async (session)=>{
            //     await this.job.promote();//立即执行job
            // })
            await this.job.promote(async (session)=>{
                await this.setStatus(this.status,MessageStatus.DOING,session)
            })
            
            result.message = 'success';
        }else{
            throw new BusinessException(`The status of this message is ${this.status}.`);
        }
        return result;

    }
    async prepare(body){


        if(this.status != MessageStatus.PENDING){//todo:: this.status改为从数据库实时获取
            throw new BusinessException('MESSAGE_PREPARE_STATUS_MISTAKE',{currentStatus:this.status});
        }
        let data = {
            id:  this.id,
            prepare_subtasks : []
        };
        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            if(body.prepare_subtasks && body.prepare_subtasks.length > 0 ){
                this.subtasks = await this.createSubtasks(body.prepare_subtasks,session);
            }
            await this.setStatus(MessageStatus.PENDING,MessageStatus.PREPARED,session);
        })
        await session.endSession();
        await this.initProperties();


     
        return data;  
   
    }
    private async createSubtasks(prepareSubtasksBody,session:ClientSession){
        let subtasks:Subtask[] = [];

        for (const subtaskBody of prepareSubtasksBody) {
            // let subtask:Subtask = await this.addSubtask(subtaskBody.type,subtaskBody);
            let subtask:Subtask = await this.createSubtask(subtaskBody.type,subtaskBody,session);
        }
        return subtasks;
    }

    // public async prepareSubtasks(subtasks){
    //     let prepareSubtasksResult = [];
    //     for (const subtask of subtasks) {
    //         await subtask.prepare()
    //         prepareSubtasksResult.push(OnDemandFastToJson(subtask));
    //     }
    //     return prepareSubtasksResult;
    // }


    public async loadJob(){
        let jobModel = await this.producer.jobManager.getJobModel(this.job_id);
        this.job = new MessageJob(this);
        await this.job.restore(jobModel);
        return this;
    }

    async addSubtask(type,body){


        if(this.status != MessageStatus.PENDING){//锁住message,获取状态再判断
            throw new BusinessException('MESSAGE_ADD_SUBTASK_STATUS_MISTAKE',{currentStatus:this.status});
        }
        let session = await this.database.connection.startSession();
        let subtask:Subtask;
        await session.withTransaction(async()=>{
            subtask = await this.createSubtask(type,body,session);
        })
        await session.endSession();
        
        if(subtask instanceof TccSubtask){ //如果是Tcc类型的subtask执行prepare
            let tccSubtask = <TccSubtask>subtask;
            await tccSubtask.prepare();
        }
        await this.initProperties();
        return subtask;
    }

    async createSubtask(type,body,session:ClientSession){
        let subtask = this.producer.subtaskManager.factory(this,type);
        await subtask.create(body,session);
        await this.incSubtaskTotal(subtask,session);
        return subtask;
    }


    async incSubtaskTotal(subtask:Subtask,session:ClientSession){
        let updateResult = await this.database.MessageModel
        .findOneAndUpdate({_id:this.id ,status:MessageStatus.PENDING},{
            $inc:{
                pending_subtask_total: +1,
                subtask_total: +1
            }
        },{session,new:true})
        this.model = updateResult;

        if(!updateResult){
            let exists = await this.database.MessageModel.exists({_id: this.id});
            if(!exists){
                throw new BusinessException('MESSAGE_INC_SUBTASK_TOTAL_NOT_FOUND')
            }
            let currentStatus = await this.getStatus();
            throw new BusinessException('MESSAGE_INC_SUBTASK_TOTAL_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus:MessageStatus.PENDING})
        }
        this.subtasks.push(subtask);
    }
}