

import { Injectable} from '@nestjs/common';
import { Actor } from './Actor';
import { Config } from '../Config';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { MasterModels } from '../Models/MasterModels';
import { ActorStatus } from '../Constants/ActorConstants';
import {AppLogger} from '../Handlers/AppLogger';
import { Application } from '../Application';
import NohmModel, { IDictionary } from 'nohm/tsOut/model';
import { BusinessException } from '../Exceptions/BusinessException';
import { ActorConfigManager } from './ActorConfigManager';


@Injectable()
export class ActorManager{
    public application:Application;
    public actors : Map<number,Actor> = new Map();
    public actorsName: Map<string,Actor> = new Map();
    
    /**
     * 
     * @param configToMasterRedis 为了保证再调用initActors前，完成了配置文件到redis的更新操作
     * @param actorService 
     * @param config 
     * @param redisManager 
     */
    constructor(public config:Config,private redisManager:RedisManager,public masterModels:MasterModels,public actorConfigManager:ActorConfigManager){

    }

    public setApplication(application:Application){
        this.application = application;
    }

    public async bootstrap(bootstrap=true){
        let actorModels = await this.actorConfigManager.getAllActiveActorModels();
        let promises = [];


        for(let actorModel of actorModels){
            promises.push(this.initActor(actorModel,bootstrap));   
        }
        await Promise.all(promises);//并行启动
        //todo::通过masterRedis对比，取出配置文件不存在的actor也进行初始化，用于后续手动操作
        AppLogger.log('actor running...','ActorManager')
    }

    public async initActor(actorModel,bootstrap=true){
        let actor = new Actor(this,this.redisManager);
        await actor.init(actorModel)
        if(bootstrap){
            await actor.bootstrap()
        }
        this.actors.set(actor.id,actor);
        this.actorsName.set(actor.name,actor);
        return actor;
    }

    public async reload(name:string = '*'){
        if(name == "*"){
            return this.reloadAll();
        }

        let actorModels = await this.masterModels.ActorModel.findAndLoad({
            name: name
        })
        if(actorModels.length > 0){
            return this.reloadOne(actorModels[0]);
        }
        throw new BusinessException(`(${name}) actor not exists.`)
    }

    public async reloadAll(){
        let actorModels = await this.actorConfigManager.getAllActorModels();
        let promises = [];

        for(let actorModel of actorModels){
            promises.push(this.reloadOne(actorModel))
        }
        await Promise.all(promises);//并行启动
        AppLogger.log('actor running...','ActorManager')
    }

    public async reloadOne(actorModel:NohmModel<IDictionary>){

        //标记为REMOVED的actor,关闭并且移除
        if(actorModel.property('status') == ActorStatus.REMOVED){
            let actor = this.actors.get(Number(actorModel.id));
            if(actor){
                await this.removeActor(actor);
                AppLogger.warn(`Actor removed...... ${actor.name}`,'ActorManager')
            }
            return 
        }
        
        let actor = this.actors.get(Number(actorModel.id));

        if(actor){//重新加载actor
            await actor.shutdown()
            await actor.init(actorModel);
            await actor.bootstrap()
        }else{
            AppLogger.warn(`Actor add...... ${actorModel.property('name')}`,'ActorManager')
            await this.initActor(actorModel);//初始化新的actor
        }
    }

    public async removeActor(actor:Actor){
        await actor.shutdown();
        this.actors.delete(actor.id);
        this.actorsName.delete(actor.name)
    }

    public async shutdown(){
        let actorClosePromises=[];
        for(let [id,actor] of this.actors){
            actorClosePromises.push(actor.shutdown());
        }
        return Promise.all(actorClosePromises);
    }
    
    

    public get(name:string):Actor{
        return this.actorsName.get(name);
    }
    public getById(id:number):Actor{
        return this.actors.get(Number(id));
    }


    public async getJobGlobalId(){
        let masterRedisClient = await this.redisManager.client();
        return String(await masterRedisClient.incr('global:ids:job'));
    }
    public async getMessageGlobalId(){
        let masterRedisClient = await this.redisManager.client();
        return masterRedisClient.incr('global:ids:message');
    }
    public async getSubtaskGlobalId():Promise<string>{
        let masterRedisClient = await this.redisManager.client();
        return String(await masterRedisClient.incr('global:ids:subtask'));
    }

}