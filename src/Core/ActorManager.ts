

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ActorService } from '../Services/ActorService';
import { Actor } from './Actor';
import { Config } from '../Config';
import { RedisManager } from '../Handlers/redis/RedisManager';


@Injectable()
export class ActorManager{
    private actors : Map<number,Actor> = new Map();
    private actorsName: Map<string,Actor> = new Map();
    
    /**
     * 
     * @param configToMasterRedis 为了保证再调用initActors前，完成了配置文件到redis的更新操作
     * @param actorService 
     * @param config 
     * @param redisManager 
     */
    constructor(@Inject('configToMasterRedis') configToMasterRedis,private actorService:ActorService,private config:Config,private redisManager:RedisManager){

    }


    public async initActors(){
        let actorsConfig = this.config.actors;
        for(let [i,actorConfig] of actorsConfig){
            let actor = Object.assign(new Actor(this.redisManager),actorConfig);
            await actor.init();
            this.actors.set(actor.id,actor);
            this.actorsName.set(actor.name,actor);
            
        }
        //todo::通过masterRedis对比，取出配置文件不存在的actor也进行初始化，用于后续手动操作
        Logger.log('Inited actors.','Bootstrap')
    }

    public get(name:string){
        return this.actorsName.get(name);
    }

    public async bootstrapActorsCoordinatorProcesser(){

    }
}