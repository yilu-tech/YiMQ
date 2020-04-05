

import { Injectable, Logger, Inject, UnprocessableEntityException } from '@nestjs/common';
import { ActorService } from '../Services/ActorService';
import { Actor } from './Actor';
import { Config } from '../Config';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { MasterModels } from '../Models/MasterModels';
import { ActorStatus } from '../Constants/ActorConstants';
import {differenceBy} from 'lodash';

@Injectable()
export class ActorManager{
    public actors : Map<number,Actor> = new Map();
    private actorsName: Map<string,Actor> = new Map();
    
    /**
     * 
     * @param configToMasterRedis 为了保证再调用initActors前，完成了配置文件到redis的更新操作
     * @param actorService 
     * @param config 
     * @param redisManager 
     */
    constructor(public config:Config,private redisManager:RedisManager,public masterModels:MasterModels){

    }


    public async initActors(){
        let actorModels = await this.getAllActorModels();

        for(let actorModel of actorModels){

            let actor = new Actor(this,this.redisManager);
            actor.setModel(actorModel);
            await actor.init();
            this.actors.set(actor.id,actor);
            this.actorsName.set(actor.name,actor);
        }
        //todo::通过masterRedis对比，取出配置文件不存在的actor也进行初始化，用于后续手动操作
        Logger.log('Inited actors.','Bootstrap')
    }


    public async loadActorsRemoteConfig(){
        for(let [id,actor] of this.actors){
            if(actor.status == ActorStatus.ACTIVE){
                await actor.loadRemoteConfigToDB();
            }
            
        }
        //todo::通过masterRedis对比，取出配置文件不存在的actor也进行初始化，用于后续手动操作
        Logger.log('Load actors remote config.','Bootstrap')
    }
    public async closeActors(){
        for(let [id,actor] of this.actors){
            await actor.close();
        }
    }

    public get(name:string):Actor{
        return this.actorsName.get(name);
    }
    public getById(id):Actor{
        return this.actors.get(id);
    }

    public async bootstrapActorsCoordinatorprocessor(){
        for(let [id,actor] of this.actors){
            actor.coordinator.processBootstrap();
        }
    }

    public async getJobGlobalId(){
        let masterRedisClient = await this.redisManager.client();
        return masterRedisClient.incr('global:ids:job');
    }
    public async getMessageGlobalId(){
        let masterRedisClient = await this.redisManager.client();
        return masterRedisClient.incr('global:ids:message');
    }
    public async getSubtaskGlobalId():Promise<string>{
        let masterRedisClient = await this.redisManager.client();
        return String(await masterRedisClient.incr('global:ids:subtask'));
    }
    public async getAllActorModels(){
        let ids = await this.masterModels.ActorModel.sort({
            field: 'id',
            direction: 'ASC'
        },false);
        return this.masterModels.ActorModel.loadMany(ids);
    }


    public async saveConfigFileToMasterRedis(){
        Logger.log('Load actors to master redis.','Bootstrap');
        let actorsConfig = this.config.actors;

        let actorModels = await this.getAllActorModels();
 
        let removeActorModels = actorModels.filter((item)=>{
            for(let actorConfig of actorsConfig){
                if(Number(item.id) == Number(actorConfig.id)){
                    return false;
                } 
            }
            return true;
        })

        for (const removeActorModel of removeActorModels) {
            removeActorModel.property('status',ActorStatus.REMOVED)
            await removeActorModel.save()
            Logger.warn(removeActorModel.allProperties(),'Actor_Remove');
        }

        
        for(let actorConfig of actorsConfig){


            let actorModel = (await this.masterModels.ActorModel.findAndLoad({
                id: actorConfig.id
            }))[0]
            
            if(actorModel){
                Logger.log(actorModel.allProperties(),'Actor_Update');
            }else{
                actorModel = new this.masterModels.ActorModel();
                Logger.log(actorConfig,'Actor_Add');
            }
            actorModel.id = actorConfig.id;
            actorModel.property('id',actorConfig.id);
            actorModel.property('name',actorConfig.name);

            actorModel.property('key',actorConfig.key);

            actorModel.property('api',actorConfig.api);
            actorModel.property('status',ActorStatus.ACTIVE);
            actorModel.property('protocol',actorConfig.protocol);
            actorModel.property('redis',actorConfig.redis);
            actorModel.property('redisOptions',this.config.system.redis[actorConfig.redis]);
            await  actorModel.save(); 
        }
        Logger.log('Loaded actors to master redis.','Bootstrap');
        return true;
    }

}