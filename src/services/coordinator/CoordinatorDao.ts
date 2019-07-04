import { Injectable } from "@nestjs/common";
import { RedisManager } from "../../handlers/redis/RedisManager";



@Injectable()
export class CoordinatorDao{
    private key = 'system:coordinators';
    constructor(private redisManager:RedisManager){

    }
    public async add(options){
        return await this.redisManager.client().hmset(this.key,options.name,JSON.stringify(options));
    }
    public async get(name) {
        return await this.redisManager.client().hget(this.key,name);
        
    }
    public async all(){
        let items = await this.redisManager.client().hgetall(this.key);
        for(let key in items){
            items[key] = JSON.parse(items[key]);
        }
        return items;
    }
    public async exists(name){
        return await this.redisManager.client().hexists(this.key,name);
    }   
    public delete(name){

    }
    public update(name,options){

    }
}


