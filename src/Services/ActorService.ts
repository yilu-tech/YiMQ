import { Injectable } from "@nestjs/common";
import { ModelFactory } from "../Handlers/ModelFactory";
import { ActorModel } from "../Models/ActorModel";

@Injectable()
export class ActorService{
    constructor(private modelFactory:ModelFactory){

    }

    public async create(data):Promise<ActorModel>{
        let actor = this.modelFactory.assign<ActorModel>(ActorModel,data);
        actor = await this.modelFactory.create<ActorModel>(actor);
        return actor;
    }
    public async get(name){
        return this.modelFactory.find(ActorModel,name);
    }
    public async delete(name){
        return this.modelFactory.delete(ActorModel,name);;
    }

    public async update(name,updateData){
        return this.modelFactory.update(ActorModel,name,updateData);
    }

    public async all(){
        return this.modelFactory.all<ActorModel>(ActorModel);
    }

    
}


