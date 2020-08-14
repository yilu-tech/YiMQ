import { Actor } from "./Actor";
import { MessageStatus, MessageClearStatus } from "../Constants/MessageConstants";
import { CoordinatorCallActorAction } from "../Constants/Coordinator";
import { SystemException } from "../Exceptions/SystemException";
import { Message } from "./Messages/Message";
import { ConsumerSubtask } from "./Subtask/BaseSubtask/ConsumerSubtask";
import { JobType, JobStatus } from "../Constants/JobConstants";
import { Logger } from "../Handlers/Logger";
import { JobOptions } from "bull";
import { difference } from "lodash";
import IORedis = require("ioredis");



export class ActorCleaner{

    public db_key_wating_clear_processors:string;
    public db_key_failed_clear_processors:string;
    public db_key_clear_jobs:string;

    constructor(private actor:Actor){

        this.db_key_wating_clear_processors = `actors:${this.actor.id}:wating_clear_processors`;
        this.db_key_failed_clear_processors = `actors:${this.actor.id}:failed_clear_processors`;
        this.db_key_clear_jobs = `actors:${this.actor.id}:clear_jobs`;

    }


    public async run(){
        let doneMessageIds = await this.getMessageIds(MessageStatus.DONE,MessageClearStatus.WAITING);
        let canceldMessageIds = await this.getMessageIds(MessageStatus.CANCELED,MessageClearStatus.WAITING);
        let watingClearProcessorIds = await this.getWatingClearConsumeProcessorIds();//获取等待清理的processers

        if(doneMessageIds.length < this.actor.options.clear_limit 
            && watingClearProcessorIds.length < this.actor.options.clear_limit 
            && watingClearProcessorIds.length < this.actor.options.clear_limit
            ){
            let message = `<${this.actor.name}> actor not have message and process to clear`;
            Logger.debug(message,'ActorCleaner');
            return {message,delay:true}
        }

        let [failedDoneMessageIds,failedcCanceledMessageIds,failed_process_ids] = await this.remoteClear(doneMessageIds,canceldMessageIds,watingClearProcessorIds);

        let cleardDoneMessageIds = await this.clearLocalMessage(doneMessageIds,failedDoneMessageIds);
        let cleardCanceldMessageIds = await this.clearLocalMessage(canceldMessageIds,failedcCanceledMessageIds);
        let cleardProcessorIds = await this.clearLocalProcessorIds(watingClearProcessorIds,failed_process_ids);//清理掉本次已经远程清理了的processor的id
        return {cleardDoneMessageIds,cleardCanceldMessageIds,cleardProcessorIds,delay:false}
    }

    


    public async setClearJob(delay:boolean){
        let data = {type:JobType.ACTOR_CLEAR};
        let jobName = JobType.ACTOR_CLEAR;

    

        if(await this.getActiveJob()){
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
        return this.actor.coordinator.getQueue().add(jobName,data,options);
    }



    public async getActiveJob(){
        let job = await this.actor.jobManager.get(await this.getActiveJobId());
        if(job && (await job.getStatus()) != JobStatus.COMPLETED){
            return job;
        }
        return null;
    }

    public async getActiveJobId(){
        return this.actor.redisClient.lindex(this.db_key_clear_jobs,0)
    }

    public async getMessageIds(status:MessageStatus.DONE|MessageStatus.CANCELED,messageClearStatsu:MessageClearStatus){
        return await this.actor.redisClient['getClearMessageIds'](this.actor.id,status,messageClearStatsu,this.actor.options.clear_limit);
    }

    /**
     * 获取清理失败的message
     */
    public async getFailedClearMessageIds(){
        let messageIds = await this.actor.messageModel.find({
            actor_id: this.actor.id,
            clear_status: MessageClearStatus.FAILED
        })
        messageIds = messageIds.slice(0,this.actor.options.clear_limit);
        return messageIds;
    }


    public async clearLocalMessage(originMessageIds,failedMessageIds){
        await this.markFailedMessages(failedMessageIds);
        let canCleardMessageIds =  await this.getCanCleardMessageIds(originMessageIds,failedMessageIds);
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

    public async getCanCleardMessageIds(originMessageIds,failedMessageIds){
        return difference(originMessageIds,failedMessageIds);
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
        if(originProcessIds.length > 0){
            this.clearDbWatingProcessorIds(multi,originProcessIds); 
        } 
        await multi.exec();
        let canCleardProcessorIds = difference(originProcessIds,failedProcessIds);
        return canCleardProcessorIds;

    }
    public async moveFailedProcessIds(multi:IORedis.Pipeline,failedProcessIds){
         multi.sadd(this.db_key_failed_clear_processors,failedProcessIds);
    }

    public async getFailedClearProcessIds():Promise<number[]>{
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
            canceld_message_ids: canceldMessageIds,
            process_ids: watingClearProcessorIds
        }
        let result = await this.actor.coordinator.callActor(this,CoordinatorCallActorAction.ACTOR_CLEAR,body);
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
    public async getWatingClearConsumeProcessorIds():Promise<number[]>{
        return this.actor.redisClient.srandmember(this.db_key_wating_clear_processors,this.actor.options.clear_limit);
    }

}