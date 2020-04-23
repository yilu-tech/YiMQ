import { Injectable } from '@nestjs/common';
import { Logger} from './Handlers/Logger';
import { MasterModels } from './Models/MasterModels';
import { ActorManager } from './Core/ActorManager';
import { RedisManager } from './Handlers/redis/RedisManager';
import { RedisClient } from './Handlers/redis/RedisClient';
import { Config } from './Config';
import { ActorConfigManager } from './Core/ActorConfigManager';
const { setQueues } = require('bull-board')
@Injectable()
export class Application {
    public masterRedisClient:RedisClient;
    constructor(public redisManager:RedisManager, public masterModels:MasterModels, public actorConfigManager:ActorConfigManager,public actorManager:ActorManager,public config:Config){
    }

    private online = true;

    public setOnline(){
        this.online = true;
    }
    public setOffline(){
        this.online = false;
    }
    public isOnline(){
        return this.online;
    }

    async baseBootstrap(){
        await this.masterModels.register()
        await this.actorConfigManager.saveConfigFileToMasterRedis()
        await this.actorConfigManager.loadRemoteActorsConfig();
    }
    async bootstrap(){
        await this.baseBootstrap();
        await this.actorManagerBootstrap();
        await this.setUiQueue();
    }
    async actorManagerBootstrap(){
        await this.actorManager.bootstrap();
        

        this.masterRedisClient = await this.redisManager.client();

        let subscribeRedisClient = await this.redisManager.getDefaultSubscribeClient();

        Logger.log('Subscribe ACTORS_CONFIG_UPDATED event','Application');
        subscribeRedisClient.subscribe('ACTORS_CONFIG_UPDATED',function(err,count){
            if(err){
                Logger.error(new Error(err));
            }
        })
        subscribeRedisClient.on('message',async (channel, message)=>{
            if(channel == 'ACTORS_CONFIG_UPDATED'){
                Logger.log('........Actor Manager Restart........','Application');
                await this.actorManager.shutdown();
                await this.actorManager.bootstrap();
                await this.setUiQueue();
            }
        })
    }

    async publishActorsConfigChange(){
        this.masterRedisClient.publish('ACTORS_CONFIG_UPDATED',Date.now().toString());
    }

    // async shutdown(){
    //     // await this.actorManager.shutdown();
    //     Logger.log('ActorManager shutdown','Application');
    //     // await this.masterModels.shutdown();
    //     Logger.log('MasterModels shutdown','Application');
    //     // await this.redisManager.shutdown();
    //     Logger.log('RedisManager shutdown','Application');
        
    // }
    
    async setUiQueue(){//TODO 自己开发ui后移除
        
        let queues = [];
        this.actorManager.actors.forEach((actor)=>{
            queues.push(actor.coordinator.getQueue());
        })
        setQueues(queues);
    }
}
