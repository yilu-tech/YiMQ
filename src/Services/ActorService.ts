import { Injectable } from "@nestjs/common";
import { MasterModels } from "../Models/MasterModels";
import { Config } from "../Config";

import { BusinessException } from "../Exceptions/BusinessException";
import { NohmModel } from "nohm";
import { ActorModelClass } from "../Models/ActorModel";
import { ActorManager } from "../Core/ActorManager";
import { ExposeGroups, OnDemandSwitch } from "../Constants/ToJsonConstants";
import { OnDemandRun, OnDemandToJson } from "../Decorators/OnDemand";
import { MessageStatus } from "../Constants/MessageConstants";
import { sortBy } from "lodash";
import { Actor } from "../Core/Actor";




@Injectable()
export class ActorService{
    constructor(private masterModels:MasterModels,private config:Config,private actorManager:ActorManager){


    }

  
    public async get(id){
        let model = await this.getModel(id);
        return model.allProperties();
    }
    public async getModel(id):Promise<NohmModel>{
        try {
            return this.masterModels.ActorModel.load<ActorModelClass>(id);
        } catch (error) {
            if (error && error.message === 'not found') {
                throw new BusinessException('Not found.')
            } 
            throw error;
        }
    }
    public async delete(id){
        let actor = await this.getModel(id);
        actor.remove();
    }

    public async update(id,updateData){
        let actor = await this.getModel(id);
        actor.property(updateData);
        await actor.save();
        return actor.allProperties();
    }

    // public async list(){
    //     let actors = [];
    //     for (const [i,actor] of this.actorManager.actors) {
    //         let actorJson = OnDemandToJson(actor,[]);
    //         actorJson['job_counts'] = await actor.coordinator.getJobConuts();
    //         actors.push(actorJson);
    //     }
    //     actors = sortBy(actors,(actor)=>{
    //         return actor.id;
    //     })
    //     return actors;
    // }

    public async getAllStatus(full:boolean){

        let actorPromises = []
        for (const [i,actor] of this.actorManager.actors) {

            actorPromises.push(this.getStatus(actor.id,full));
        }
        let actors = await Promise.all(actorPromises);
        actors = sortBy(actors,(actor:Actor)=>{
            return actor.id;
        })
        return actors;
    }

    public async getStatus(actor_id,full){
        let actor = this.actorManager.getById(actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${actor_id} is not exists.`)
        }
        let promises = [];
        let actorJson = OnDemandToJson(actor,[]);
        promises.push(actor.coordinator.getJobConuts());

        if(full){
            promises.push(this.getMessageCounts(actor));
        }
        promises.push(actor.actorCleaner.getCounts());
        let result = await Promise.all(promises)
        actorJson['job_counts'] = result[0];
        if(full){
            actorJson['message_counts'] = result[1];
            actorJson['clear_counts'] = result[2];
        }else{
            actorJson['clear_counts'] = result[1];
        }
        return actorJson;
    }
    /**
     * todo: 优化为lua脚本
     * @param actor 
     */
    public async getMessageCounts(actor:Actor){
        let message_counts = {};
        for (const messageStatus of [MessageStatus.CANCELED,MessageStatus.CANCELLING,MessageStatus.DOING,MessageStatus.DONE,MessageStatus.PENDING]) {
            let ids = await actor.messageModel.find({
                actor_id: actor.id,
                status: messageStatus
            })
            message_counts[messageStatus] = ids.length;
        }
        return message_counts;
    }

    public async jobs(actor_id,status:[], start?: number, size?: number, sort?: 'ASC'|'DESC'){
        let actor = this.actorManager.getById(actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${actor_id} is not exists.`)
        }
        let asc = sort == 'ASC' ? true : false;
        let end = start + size - 1;

        let jobs = await actor.coordinator.getJobs(status,start,end,asc)

        let OnDemandSwitchs = [OnDemandSwitch.MESSAGE_SUBTASKS_TOTAL]

        if(status.length > 1){ //如果两个查询两个状态以上，返回job是status
            OnDemandSwitchs.push(OnDemandSwitch.JOB_STATUS)
        }
        await OnDemandRun(jobs,OnDemandSwitchs)

        let items = [];
        for (const job of jobs) {
            let item = OnDemandToJson(job,[ExposeGroups.JOB_PARENT,ExposeGroups.RELATION_ACTOR])
            
            items.push(item);
        }

        let job_counts = await actor.coordinator.getJobConuts();
        let total = 0;
        for (const item of status) {
            total += job_counts[item];
        }

        return {
            total: total,
            start: start,
            size: size,
            sort: sort, 
            jobs: items,
        };
    }

    public async job(actor_id,job_id){
        let actor = this.actorManager.getById(actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${actor_id} is not exists.`)
        }
        let job = await actor.jobManager.get(job_id);
        if(!job){
            throw new BusinessException(`job ${job_id} of actor ${actor_id} is not exists.`)
        }
        // console.time('OnDemandRun');
        await OnDemandRun(job,[
            OnDemandSwitch.JOB_STATUS,
            OnDemandSwitch.MESSAGE_SUBTASKS_TOTAL,
            OnDemandSwitch.MESSAGE_SUBTASKS
        ])
        // console.timeEnd('OnDemandRun');
        // console.time('OnDemandToJson');
        let result =  OnDemandToJson(job,[
            ExposeGroups.JOB_PARENT,
            ExposeGroups.SUBTASK_MESSAGE,
            ExposeGroups.JOB_FULL,
            ExposeGroups.RELATION_ACTOR
        ]);
        // console.timeEnd('OnDemandToJson');
        // console.time('OnDemandFastTOJson');
        // let json = OnDemandFastTOJson(job,[ExposeGroups.ACTOR_BASIC,ExposeGroups.SUBTASK_PARENT,ExposeGroups.JOB_FULL]);
        // console.timeEnd('OnDemandFastTOJson');

        return result;
    }

    public async jobRetry(actor_id,job_ids){
        let actor = this.actorManager.getById(actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${actor_id} is not exists.`)
        }

        return await actor.coordinator.retry(job_ids);
    }






    public async getAllClearFailedList(){
        let startingTime = Date.now();
        let actorModels = await this.actorManager.actorConfigManager.getAllActiveActorModels();
        let actorClearFailedLists:any = {};
        for (const actorModel of actorModels) {
            let actorClearFailedList = await this.getClearFailedList(actorModel.id);
            // let key = `${actorModel.id}-${actorModel.property('name')}   M:${actorClearFailedList.messages.length}  P:${actorClearFailedList.process_ids.length}`
            let messageKey = `${actorModel.id}-${actorModel.property('name')}-messages`;
            let processIdsKey = `${actorModel.id}-${actorModel.property('name')}-process_ids`;
            actorClearFailedLists[messageKey]= actorClearFailedList.messages;
            actorClearFailedLists[processIdsKey]= actorClearFailedList.process_ids;
        }
        let cost_time = (Date.now() - startingTime);
        actorClearFailedLists.cost_time = `${cost_time}ms`;
        return actorClearFailedLists;
    }

    public async getClearFailedList(actor_id){
        let startingTime = Date.now();

        let actor = this.actorManager.getById(actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${actor_id} is not exists.`)
        }

        
        let {failedRetryDoneMessageIds,failedRetryCanceldMessageIds} = await actor.actorCleaner.getFailedClearMessageIds();
        let clearFailedMessageIds = failedRetryDoneMessageIds.concat(failedRetryCanceldMessageIds);

        let messagePipeline = actor.redisClient.pipeline();
        for (const clearFailedMessageId of clearFailedMessageIds) {
            let messageKey = `nohm:hash:message:${clearFailedMessageId}`
            messagePipeline.hgetall(messageKey)
        }
        let messagePipelineResults = await messagePipeline.exec();
        let clearFailedMessages = messagePipelineResults.map((result)=>{
            return result[1];
        })

        let cost_time = (Date.now() - startingTime);

        return {
            messages: clearFailedMessages,
            process_ids: await actor.actorCleaner.getFailedClearProcessIds(),
            cost_time : `${cost_time}ms`
        }
    }

    
}


