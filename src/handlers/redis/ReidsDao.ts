import { RedisManager } from "./RedisManager";
import { RedisClient } from "./RedisClient";
import { Injectable } from "@nestjs/common";
import { Model } from "../Model";

@Injectable()
export class RedisDao{
    protected key_prefix: string = "models";
    protected client:RedisClient;
    constructor(protected redisManager:RedisManager){
        this.client = this.redisManager.client();

    }

    public async create<TModel>(model:Model):Promise<Model>{

        await this.checkIndexs(model);
        let multi = this.client.multi();
        this._insert(multi,model);

        await multi.exec();
        let item = await this.find(model,model.getPrimaryValue());
        return model.assign(item);


    }

    public async delete(model:Model):Promise<boolean>{
        let multi = this.client.multi();
        this._delete(multi,model);
        await multi.exec()
        return true;
    }

    public async update(originModel:Model,model:Model):Promise<boolean>{


        if(!model){
            throw new Error(`${this.getPrimaryKey(model,model.getPrimaryValue())} not exist.`);
        }
        await this.checkIndexs(model,originModel);
        let multi = this.client.multi();
        this._delete(multi,originModel); //删除
        this._insert(multi,model); //添加

        await multi.exec();
        return true;
    }
    private async checkIndexs(model:Model,originModel:Model=null){

        let multi = this.client.multi();
        let indexs = model.getIndexs();

        let checkedKeys = [];
        for(let key of indexs){
            //如果索引没有发生变化，跳过
            if(originModel && originModel[key] == model[key]){
                continue;
            }
            multi.hexists(this.getIndexKey(model,key),model[key]);
            checkedKeys.push(key);
        }

        let result =await multi.exec();
        result.forEach((item,index)=>{
            if(item[1] == 1){
                throw new Error(`${model.getModelName()} of ${checkedKeys[index]} ${model[checkedKeys[index]]} is exist.`);
            }
        })
    }

    private _delete(multi,model:Model){
        //删除索引
        for(let key of model.getIndexs()){
            multi.hdel(this.getIndexKey(model,key),model[key]);
        }
        multi.srem(this.getItemsKey(model),this.getPrimaryKey(model,model.getPrimaryValue())) //维护member
        multi.del(this.getPrimaryKey(model,model.getPrimaryValue())); //删除数据
    }

    private _insert(multi,model:Model){
         //添加索引
         for(let key of model.getIndexs()){
            if(model.getValue(key)){
                multi.hmset(this.getIndexKey(model,key),model.getValue(key),this.getPrimaryKey(model,model.getPrimaryValue()));
            }
        }
        multi.sadd(this.getItemsKey(model),this.getPrimaryKey(model,model.getPrimaryValue())) //维护member
        multi.hmset(this.getPrimaryKey(model,model.getPrimaryValue()),model.toJson()); //保存数据
    }
    

    protected getIndexKey(model:Model,index){
        return `${this.key_prefix}:${model.getModelName()}:_${index}`;
    }

    protected getPrimaryKey(model,value){
        return  `${this.key_prefix}:${model.getModelName()}:items:${value}`;
    }
    protected getItemsKey(model){
        return  `${this.key_prefix}:${model.getModelName()}:_items`;
    }

    public async find<TModel>(model:Model,primaryValue):Promise<any>{
        let item =  await this.client.hgetall(this.getPrimaryKey(model,primaryValue));
        if(Object.keys(item).length > 0){
            return item;
        }else{
            return null;
        }

    }

    public async exist<TModel>(model:Model,primaryValue):Promise<any>{
        return await this.client.sismember(this.getItemsKey(model),this.getPrimaryKey(model,primaryValue));
    }


    private async allItem(model:Model){
        return await this.client.smembers(this.getItemsKey(model));

    }
    public async all(model:Model):Promise<any>{
        let itemsKeys = await this.allItem(model);
        let keys = Object.keys(itemsKeys).map(id => itemsKeys[id]);
        return await this.phgetall(keys);
       
    }

    private async phgetall(keys) {

        var pipeline = this.client.pipeline();
    
        keys.forEach(function(key, index){
            pipeline.hgetall(key);
        });
    
        let items = await pipeline.exec()
        return items.map((item)=>{
            return item[1];
        })
    }
}