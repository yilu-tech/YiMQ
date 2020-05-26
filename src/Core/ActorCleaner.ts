import { Actor } from "./Actor";
import { MessageStatus } from "../Constants/MessageConstants";
import { CoordinatorCallActorAction } from "../Constants/Coordinator";
import { SystemException } from "../Exceptions/SystemException";
import { Message } from "./Messages/Message";
import { ConsumerSubtask } from "./Subtask/BaseSubtask/ConsumerSubtask";
import { JobType } from "../Constants/JobConstants";
import { Logger } from "../Handlers/Logger";
import { JobOptions } from "bull";



export class ActorCleaner{
    public db_key_lock:string;
    public db_key_job_id:string;
    public db_key_last_job_id:string;//上一个已经完成的清理jobid (测试用)
    public db_key_wating_clear_processors:string;
    constructor(private actor:Actor){
        this.db_key_lock = `actors:${this.actor.id}:db_key_lock`;
        this.db_key_job_id = `actors:${this.actor.id}:cleaner_job_id`;
        this.db_key_last_job_id = `actors:${this.actor.id}:cleaner_last_job_id`;
        this.db_key_wating_clear_processors = `actors:${this.actor.id}:wating_clear_processors`;

    }

    


    public async setClearJob(init=false){
        let data = {type:JobType.ACTOR_CLEAR};
        let jobName = JobType.ACTOR_CLEAR;

    

        if(init && await this.hasActiveClearJob()){
            return
        }

        if((await this.getLock()) == null){
            return;
        }

        let job_id = await this.actor.actorManager.getJobGlobalId();
        await this.actor.redisClient.set(this.db_key_last_job_id,await this.getJobId());
        await this.actor.redisClient.set(this.db_key_job_id,job_id);
        let options:JobOptions = {
            delay:this.clearInterval,
            attempts:3,
            jobId: job_id,
            removeOnComplete:true,
            backoff:{
                type:'exponential',
                delay: 1000*5
            }
        }
        await this.actor.coordinator.getQueue().add(jobName,data,options);
        await this.removeLock();
    }

    public async getLock(){
        return await this.actor.redisClient.set(this.db_key_lock,1,'EX',10,'NX')
    }
    public async removeLock(){
        return await this.actor.redisClient.del(this.db_key_lock);
    }
    public async hasActiveClearJob(){
        let job = await this.actor.coordinator.getJob(await this.getJobId());
        if(job){
            return true;
        }
        return false;

    }

    public async getJobId(){
        return  await this.actor.redisClient.get(this.db_key_job_id);
    }
    public async getLastJobId(){
        return  await this.actor.redisClient.get(this.db_key_last_job_id);
    }

    
    public get clearInterval() : number {
        return this.actor.options.clear_interval ? this.actor.options.clear_interval : 1000*10;
    }
    


    public async clearActor(){
        let doneMessageIds = await this.getDoneMessage();//获取done和cancled状态的message
        let watingClearProcessorIds = await this.getWatingClearConsumeProcessors();//获取等待清理的processers
        if(doneMessageIds.length == 0 && watingClearProcessorIds.length == 0 ){
            let message = `<${this.actor.name}> actor not have message and process to clear`;
            Logger.debug(message,'ActorCleaner');
            return {message}
        }
        console.log(`actor_clear ${this.actor.id} message `,doneMessageIds.length,JSON.stringify(doneMessageIds));
        console.log(`actor_clear ${this.actor.id} processor`,watingClearProcessorIds.length,JSON.stringify(watingClearProcessorIds));
        await this.clearRemote(doneMessageIds,watingClearProcessorIds)//清理远程
        await this.saveSubtaskIdsToConsumer(doneMessageIds);//保存此次清理的mesaage对应的subtask的id到消费actor，用于清理远程prcessor
        await this.clearDbMeesage(doneMessageIds);//清理message 和 subtasks
        await this.clearDbWatingConsumeProcessors(watingClearProcessorIds);//清理掉本次已经远程清理了的processor的id
        return {doneMessageIds,watingClearProcessorIds}
    }


    public async getDoneMessage():Promise<string[]>{
        let doneMessageIds = await this.actor.messageModel.find({
            actor_id: this.actor.id,
            status:MessageStatus.DONE,
            updated_at: {
                max: (new Date().getTime()) - this.clearInterval,
                limit: 2000
            },
        })
        let canceldMessageIds = await this.actor.messageModel.find({
            actor_id: this.actor.id,
            status:MessageStatus.CANCELED,
            updated_at: {
                max: (new Date().getTime()) - this.clearInterval ,
                limit: 2000
            }
        })
        return [...doneMessageIds,...canceldMessageIds];
    }

    public async clearRemote(messageIds,processIds){
        let body ={
            message_ids: messageIds,
            process_ids: processIds
        }
        let result = await this.actor.coordinator.callActor(this,CoordinatorCallActorAction.ACTOR_CLEAR,body);
        if(!result || result.message != 'success'){
            throw new SystemException(`Actor remote clear is failed, response message is not success.`);
        }

    }

    public async clearDbMeesage(messageIds){
        for (const messageId of messageIds) {
            let message:Message = await this.actor.messageManager.get(messageId);
            await message.delete();
        }

    }
    public async clearDbWatingConsumeProcessors(processIds:number[]){
        if(processIds.length>0){
            await this.actor.redisClient.srem(this.db_key_wating_clear_processors,processIds);
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
    public async getWatingClearConsumeProcessors():Promise<number[]>{
        return this.actor.redisClient.srandmember(this.db_key_wating_clear_processors,1000);
    }

}