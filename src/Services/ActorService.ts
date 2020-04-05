import { Injectable, Logger, UnprocessableEntityException } from "@nestjs/common";
import { ActorStatus } from "../Constants/ActorConstants";
import { MasterModels } from "../Models/MasterModels";
import { Config } from "../Config";

import { BusinessException } from "../Exceptions/BusinessException";
import { NohmModel } from "nohm";
import { ActorModelClass } from "../Models/ActorModel";




@Injectable()
export class ActorService{
    constructor(private masterModels:MasterModels,private config:Config){


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

    
}


