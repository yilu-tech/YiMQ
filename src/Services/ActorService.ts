import { Injectable } from "@nestjs/common";

import { ActorModel } from "../Models/ActorModel";
import { ActorStatus } from "../Constants/ActorConstants";
import { BusinessException } from "../Exceptions/BusinessException";
import NohmModel from "nohm/tsOut/model";

@Injectable()
export class ActorService{
    constructor(){

    }

    public async create(data):Promise<any>{
        let actor = new ActorModel();
        actor.property('name',data.name);
        actor.property('key',data.key);
        actor.property('api',data.api);
        actor.property('status',ActorStatus.ACTIVE);
        await  actor.save();
        return actor.allProperties();
    }
    public async get(id){
        let model = await this.getModel(id);
        return model.allProperties();
    }
    public async getModel(id):Promise<NohmModel>{
        try {
            return await ActorModel.load(id);
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

    public async all(){

    }

    
}


