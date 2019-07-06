import { Injectable } from "@nestjs/common";
import { RedisDao } from "./redis/ReidsDao";

import {Model} from '../Models/Model';

@Injectable()
export class ModelFactory {

    constructor(public redisDao:RedisDao){

    }
    async create<TModel>(model:any):Promise<TModel>{
        return await this.redisDao.create(model);
    }
    async find<TModel>(ModelClass:any,primaryValue:string):Promise<Model>{
        let item =  await this.redisDao.find(new ModelClass,primaryValue)
        return item? this.assign(ModelClass,item) : null;
    }
    async exist<TModel>(ModelClass:any,primaryValue:string):Promise<TModel>{
        return await this.redisDao.exist(new ModelClass,primaryValue)
    }

    async all<TModel>(ModelClass:any):Promise<Array<TModel>>{
        return await this.redisDao.all(new ModelClass())
    }

    async delete(ModelClass:any,primaryValue:string):Promise<boolean>{
        let model = await this.find(ModelClass,primaryValue);

        if(!model){
            return false;
        }
        return await this.redisDao.delete(model)
    }

    async update<TModel>(ModelClass:any,primaryValue:string,data:object):Promise<boolean>{
        let model = await this.find(ModelClass,primaryValue);

        if(!model){
            return false;
        }
        return await this.redisDao.update(model,model.copyAssign(ModelClass,data));
    }
    
    public assign<TModel>(ModelClass:any,data:object):TModel{
        let model = new ModelClass();
        model.setModelFactory(this);
        for(let key of model.getFileds()){
            model[key] = data[key];
        }
        return model;
    }
}


