

import { Injectable} from '@nestjs/common';
import { Actor } from './Actor';
import { Config } from '../Config';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { MasterModels } from '../Models/MasterModels';
import { ActorStatus } from '../Constants/ActorConstants';
import {AppLogger} from '../Handlers/AppLogger';
import { Application } from '../Application';


@Injectable()
export class ActorManager{
    public application:Application;
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

    public setApplication(application:Application){
        this.application = application;
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
        AppLogger.log('Inited actors.','ActorManager')
    }
    public async bootstrap(){
        await this.initActors();
        // await this.loadActorsRemoteConfig();  
        await this.bootstrapActorsCoordinatorprocessor();
        await this.setActorsClearJob();
    }
    public async shutdown(){
        this.actors = new Map();
        this.actorsName = new Map();
    }
    
    public async closeCoordinators(){
        let coordinatorClosers=[];
        for(let [id,actor] of this.actors){
            coordinatorClosers.push(actor.coordinator.close());
        }
        return Promise.all(coordinatorClosers);
    }

    public get(name:string):Actor{
        return this.actorsName.get(name);
    }
    public getById(id:number):Actor{
        return this.actors.get(Number(id));
    }

    public async bootstrapActorsCoordinatorprocessor(){
        for(let [id,actor] of this.actors){
            //并行启动
            (async function(){
                if(actor.status == ActorStatus.ACTIVE){
                    await actor.coordinator.processBootstrap();
                    await actor.coordinator.onCompletedBootstrap();
                    AppLogger.debug(`Coordinator bootstrap`,`ActorManager <${actor.name}>`)
                }else{
                    AppLogger.error(`Coordinator can not bootstrap, Actor status is ${actor.status}`,undefined,`ActorManager <${actor.name}>`)
                }
            })()

        }
    }

    public async setActorsClearJob(){
        for(let [id,actor] of this.actors){
            await actor.actorCleaner.setClearJob(false);
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
}