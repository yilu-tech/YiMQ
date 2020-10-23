import { Actor } from "./Actor";
import { MessageStatus, MessageClearStatus } from "../Constants/MessageConstants";
import { CoordinatorCallActorAction } from "../Constants/Coordinator";
import { SystemException } from "../Exceptions/SystemException";
import { Message } from "./Messages/Message";
import { ConsumerSubtask } from "./Subtask/BaseSubtask/ConsumerSubtask";
import { JobType, JobStatus } from "../Constants/JobConstants";
import { Logger } from "../Handlers/Logger";
import { JobOptions } from "bull";
import { differenceBy, isArray } from "lodash";
import IORedis = require("ioredis");
import { BusinessException } from "../Exceptions/BusinessException";
// import {AppLogger} from '../Handlers/AppLogger';


export class ActorCleaner{

    public db_key_wating_clear_processors:string;
    public db_key_failed_clear_processors:string;
    public db_key_clear_jobs:string;

    constructor(private actor:Actor){

        this.db_key_wating_clear_processors = `actors:${this.actor.id}:wating_clear_processors`;
        this.db_key_failed_clear_processors = `actors:${this.actor.id}:failed_clear_processors`;
        this.db_key_clear_jobs = `actors:${this.actor.id}:clear_jobs`;

    }


    /**
     * 
     * @param force 强制清理，基础量的限制
     */
    public async run(){
        let doneMessageIds = await this.getMessageIds(MessageStatus.DONE,MessageClearStatus.WAITING);
        let canceldMessageIds = await this.getMessageIds(MessageStatus.CANCELED,MessageClearStatus.WAITING);
        let watingClearProcessorIds = await this.getWatingClearConsumeProcessorIds();//获取等待清理的processers
        let total = doneMessageIds.length + canceldMessageIds.length + watingClearProcessorIds.length;

        if(total < this.actor.options.clear_limit){
            let message = `<${this.actor.name}> actor not have enough message and process to clear ${total}`;
            // Logger.log(message,'ActorCleaner');
            return {message,delay:true}
        }
    
        let [failedDoneMessageIds,failedCanceledMessageIds,failed_process_ids] = await this.remoteClear(doneMessageIds,canceldMessageIds,watingClearProcessorIds);
        let cleardDoneMessageIds = await this.clearLocalMessage(doneMessageIds,failedDoneMessageIds);
        let cleardCanceldMessageIds = await this.clearLocalMessage(canceldMessageIds,failedCanceledMessageIds);
        let cleardProcessorIds = await this.clearLocalProcessorIds(watingClearProcessorIds,failed_process_ids);//清理掉本次已经远程清理了的processor的id

        let message = `<${this.actor.name}> actor cleared message: ${doneMessageIds.length + canceldMessageIds.length}  process: ${watingClearProcessorIds.length}`;
        Logger.log(message,'ActorCleaner');
        return {cleardDoneMessageIds,cleardCanceldMessageIds,cleardProcessorIds,delay:false}
    }


    


    public async setClearJob(delay:boolean){
        let data = {type:JobType.ACTOR_CLEAR};
        let jobName = JobType.ACTOR_CLEAR;

    
        let clearJob = await this.getActiveClearJob();
        if(clearJob && (await clearJob.getStatus()) == JobStatus.FAILED){
            await clearJob.context.retry();
            Logger.error(`${this.actor.name} has failed clear job retry.`,'ActorCleaner');
            return 
        }
        if(clearJob){
            // Logger.error(`${this.actor.name} has active clear job.`,'ActorCleaner');
            return null;
        }


        let job_id = await this.actor.actorManager.getJobGlobalId();

        await this.actor.redisClient.lpush(this.db_key_clear_jobs,job_id);

        let options:JobOptions = {
            delay: delay ? this.actor.options.clear_interval : 0,
            attempts:3,
            jobId: job_id,
            // removeOnComplete:true,
            backoff: this.actor.options.clear_backoff
        }
        // AppLogger.log(`${this.actor.name} clear job created.`,'ActorCleaner');
        return this.actor.coordinator.getQueue().add(jobName,data,options);
    }

    public async clearSelfJob(){
        let doneClearJobIds = await this.getDoneClearJobIds();
        
        let multi = this.actor.redisClient.multi();

        for (const job_id of doneClearJobIds) {
            let job = await this.actor.coordinator.getQueue().getJob(job_id);
            
            job && await job.remove();
            multi.lrem(this.db_key_clear_jobs,0,job.id);
        }
        await multi.exec();
    }

    public async getDoneClearJobIds():Promise<string[]>{
        return await this.actor.redisClient.lrange(this.db_key_clear_jobs,1,-1);
    }

    public async getActiveClearJob(){
        let job = await this.actor.jobManager.get(await this.getActiveJobId());
        if(job && (await job.getStatus()) != JobStatus.COMPLETED){
            return job;
        }
        return null;
    }

    public async getActiveJobId(){
        return this.actor.redisClient.lindex(this.db_key_clear_jobs,0)
    }

    public async getMessageIds(status:MessageStatus.DONE|MessageStatus.CANCELED,messageClearStatus:MessageClearStatus){
        return await this.actor.redisClient['getClearMessageIds'](this.actor.id,status,messageClearStatus,this.actor.options.clear_limit);
    }

    /**
     * 获取清理失败的message
     */
    public async getFailedClearMessageIds(){
        let failedRetryDoneMessageIds = await this.actor.messageModel.find({
            actor_id: this.actor.id,
            clear_status: MessageClearStatus.FAILED,
            status: MessageStatus.DONE
        })
        failedRetryDoneMessageIds = failedRetryDoneMessageIds.slice(0,this.actor.options.clear_limit);
        let failedRetryCanceldMessageIds = await this.actor.messageModel.find({
            actor_id: this.actor.id,
            clear_status: MessageClearStatus.FAILED,
            status: MessageStatus.CANCELED
        })
        failedRetryCanceldMessageIds = failedRetryCanceldMessageIds.slice(0,this.actor.options.clear_limit);
        return {failedRetryDoneMessageIds,failedRetryCanceldMessageIds}
    }


    public async clearLocalMessage(originMessageIds,failedMessageIds){
        await this.markFailedMessages(failedMessageIds);
        let canCleardMessageIds =  this.getCanCleardIds(originMessageIds,failedMessageIds);
        await this.saveSubtaskIdsToConsumer(canCleardMessageIds);
        //save subtask ids to consumer成功后，再删除message，防止意外终止
        await this.clearDbMeesage(canCleardMessageIds);
        return canCleardMessageIds;
    }

    public async markFailedMessages(failedMessageIds){
        for(var id of failedMessageIds){
            let message:Message = await this.actor.messageManager.get(id);
            message.setProperty("clear_status",MessageClearStatus.FAILED);
            await message.save();
        }
    }

    public getCanCleardIds(originIds,failedIds){
        return differenceBy(originIds,failedIds,String);
    }



    public async clearLocalProcessorIds(originProcessIds,failedProcessIds){
        if(originProcessIds.length == 0 && failedProcessIds.length == 0){
            return [];
        }

        let multi = this.actor.redisClient.multi();
        //先转移错误，再删除
        if(failedProcessIds.length > 0){
            this.moveFailedProcessIds(multi,failedProcessIds);
        }
        let canCleardProcessorIds = this.getCanCleardIds(originProcessIds,failedProcessIds);

        if(canCleardProcessorIds.length > 0){
            this.clearDbWatingProcessorIds(multi,canCleardProcessorIds); 
        } 
        await multi.exec();
        return canCleardProcessorIds;

    }
    public async moveFailedProcessIds(multi:IORedis.Pipeline,failedProcessIds){
         multi.sadd(this.db_key_failed_clear_processors,failedProcessIds); //加db_key_failed_clear_processors中
         multi.srem(this.db_key_wating_clear_processors,failedProcessIds); //从db_key_wating_clear_processors中移除
    }

    public async getFailedClearProcessIds():Promise<string[]>{
        return this.actor.redisClient.srandmember(this.db_key_failed_clear_processors,1000);
    }
    public async clearDbWatingProcessorIds(multi:IORedis.Pipeline,processIds:number[]){
        if(processIds.length>0){
             multi.srem(this.db_key_wating_clear_processors,processIds);
        }    
    }

    public async remoteClear(doneMessageIds,canceldMessageIds,watingClearProcessorIds){
        let body ={
            done_message_ids: doneMessageIds,
            canceled_message_ids: canceldMessageIds,
            process_ids: watingClearProcessorIds
        }
        // console.log('remoteClear-->body:',body)
        let result = await this.actor.coordinator.callActor(this,CoordinatorCallActorAction.ACTOR_CLEAR,body);
        // console.log('remoteClear-->:result',result)
        if(!result || result.message != 'success'){
            throw new SystemException(`Actor remote clear is failed, response message is not success.`);
        }
        return [result['failed_done_message_ids'],result['failed_canceled_message_ids'],result['failed_process_ids']];
    }

    public async clearDbMeesage(messageIds){
        for (const messageId of messageIds) {
            let message:Message = await this.actor.messageManager.get(messageId);
            await message.delete();
        }

    }

    public async saveSubtaskIdsToConsumer(messageIds){
        for (const messageId of messageIds) {
            let message:Message = await this.actor.messageManager.get(messageId);
            await message.loadSubtasks()
            for (const subtask of message.subtasks) {
                if(subtask instanceof ConsumerSubtask){
                    let consumerSubtask = <ConsumerSubtask>subtask;
                    consumerSubtask.consumer.actorCleaner.addWatingClearConsumeProcessorToDb(subtask.id);
                }
            }
        }
    }

    private async addWatingClearConsumeProcessorToDb(subtask_id){
        await this.actor.redisClient.sadd(this.db_key_wating_clear_processors,subtask_id);
    }
    public async getWatingClearConsumeProcessorIds():Promise<string[]>{
        return this.actor.redisClient.srandmember(this.db_key_wating_clear_processors,this.actor.options.clear_limit);
    }
    

    public async separateMessageIdsByStatus(message_ids){
        let failedRetryDoneMessageIds = [];
        let failedRetryCanceldMessageIds = [];
        let messageModels = await this.actor.messageModel.loadMany(message_ids);
        for(let messageModel of messageModels){

            if(messageModel.property('actor_id') != this.actor.id){
                throw new BusinessException(`message ${messageModel.property('id')} does not belong to actor ${this.actor.id}`);
            }
            if(messageModel.property('status') == MessageStatus.DONE){
                failedRetryDoneMessageIds.push(messageModel.id);
            }
            else if(messageModel.property('status') == MessageStatus.CANCELED){
                failedRetryCanceldMessageIds.push(messageModel.id);
            }
        }
        return {failedRetryDoneMessageIds,failedRetryCanceldMessageIds}
    }
    

    public async clearFailedReTry(message_ids:Array<number|string>|string,processor_ids:Array<number|string>|string){
        let failedRetryMessage = {failedRetryDoneMessageIds:[],failedRetryCanceldMessageIds:[]};
        let failedRetryWatingClearProcessorIds = processor_ids || [];
        
        if(message_ids == '*'){
            failedRetryMessage = await this.getFailedClearMessageIds();
        }else if(isArray(message_ids)){
            failedRetryMessage = await this.separateMessageIdsByStatus(message_ids);
        }

        if(failedRetryWatingClearProcessorIds == '*'){
            failedRetryWatingClearProcessorIds = await this.getFailedClearProcessIds();
        }

        return await this.clearFailedRetryRun(failedRetryMessage.failedRetryDoneMessageIds,failedRetryMessage.failedRetryCanceldMessageIds,failedRetryWatingClearProcessorIds);        

    }
    public async clearFailedRetryRun(failedRetryDoneMessageIds,failedRetryCanceldMessageIds,failedRetryWatingClearProcessorIds){
        let [failedDoneMessageIds,failedCanceledMessageIds,failedProcessIds] = await this.remoteClear(failedRetryDoneMessageIds,failedRetryCanceldMessageIds,failedRetryWatingClearProcessorIds);
        let cleardDoneMessageIds = await this.clearLocalMessage(failedRetryDoneMessageIds,failedDoneMessageIds);
        let cleardCanceldMessageIds = await this.clearLocalMessage(failedRetryCanceldMessageIds,failedCanceledMessageIds);
        let cleardProcessorIds = await this.clearFailedRetryLocalProcessorIds(failedRetryWatingClearProcessorIds,failedProcessIds);//清理掉本次已经远程清理了的processor的id
        
        return {
            cleardDoneMessageIds,
            failedDoneMessageIds,
            cleardCanceldMessageIds,
            failedCanceledMessageIds,
            cleardProcessorIds,
            failedProcessIds
        }
    }

    public async clearFailedRetryLocalProcessorIds(failedProcessIds,retryFailedProcessIds){
        if(failedProcessIds.length == 0 && retryFailedProcessIds.length == 0){
            return [];
        }

        let multi = this.actor.redisClient.multi();
        let canCleardProcessorIds = this.getCanCleardIds(failedProcessIds,retryFailedProcessIds);
        if(canCleardProcessorIds.length > 0){
            multi.srem(this.db_key_failed_clear_processors,canCleardProcessorIds);//重试成功的，直接从错误集合中移除
        } 
        await multi.exec();
        return canCleardProcessorIds;

    }

}