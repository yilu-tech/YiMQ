import { Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { ActorStatus } from "../Constants/ActorConstants";
import { MasterModels } from "../Models/MasterModels";
import { Config } from "../Config";

import { BusinessException } from "../Exceptions/BusinessException";
import { NohmModel } from "nohm";
import { ActorModelClass } from "../Models/ActorModel";
import { ActorManager } from "../Core/ActorManager";




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

    public async list(page=null,pageSize=10){
        let params = {}
        if(page){
            params['offset'] = (page - 1) * pageSize;
            params['limit'] = pageSize;
        }
        let ids =  await this.masterModels.ActorModel.find({id:params});
        let actorModels =  await this.masterModels.ActorModel.loadMany(ids);
        let actors = actorModels.map((actorModel)=>{
            return actorModel.allProperties();
        })
        return actors;
    }




    public async getAllClearFailedList(){
        let startingTime = Date.now();
        let actorModels = await this.actorManager.actorConfigManager.getAllActiveActorModels();
        let actorClearFailedLists:any = {};
        for (const actorModel of actorModels) {
            let actorClearFailedList = await this.getClearFailedList(actorModel.id);
            let key = `${actorModel.id}-${actorModel.property('name')}   M:${actorClearFailedList.messages.length}  P:${actorClearFailedList.process_ids.length}`
            actorClearFailedLists[key]= actorClearFailedList;
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


