import { Injectable, OnApplicationShutdown, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MasterModels } from './Models/MasterModels';
import { ActorManager } from './Core/ActorManager';
import { RedisManager } from './Handlers/redis/RedisManager';
import { RedisClient } from './Handlers/redis/RedisClient';
import { Config } from './Config';
import { ActorConfigManager } from './Core/ActorConfigManager';
const { setQueues } = require('bull-board')
import {AppLogger as Logger} from './Handlers/AppLogger';
@Injectable()
export class Application implements OnApplicationShutdown,OnApplicationBootstrap,OnModuleDestroy,OnModuleInit{
    public masterRedisClient:RedisClient;
    private startingUpTime:number;
    private shutdownTime:number;
    constructor(public redisManager:RedisManager, public masterModels:MasterModels, public actorConfigManager:ActorConfigManager,public actorManager:ActorManager,public config:Config){
    }
    async onModuleInit() {
        this.startingUpTime = Date.now();
        console.info('..........................................Starting Up..........................................');
        await this.config.loadConfig();
        await this.bootstrap();
    }

    async onApplicationBootstrap() {
       
        if(process.send){
            process.send('ready');//pm2优雅启动
        }
        console.info(`YiMQ listening on port 7379!`);
        let costTime = (Date.now() - this.startingUpTime)/1000;
        console.info(`..........................................Starting Up: ${costTime}s..........................................`);
    }

    async onModuleDestroy() {
        this.shutdownTime = Date.now();
        console.info('..........................................Shutdown..........................................');
        await this.processShutdown()
    }
    
    
    async onApplicationShutdown(signal?: string) {
        await this.resourceShutdown();
        let costTime = (Date.now() - this.shutdownTime)/1000;
        console.info(`..........................................Shutdown: ${costTime}s..........................................`);
        // process.exit(0);//框架自己有发出信号
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
    }
    async bootstrap(){
        await this.baseBootstrap();
        await this.actorConfigManager.loadRemoteActorsConfig();
        await this.actorManagerBootstrap();
        await this.setUiQueue();
    }
    async actorManagerBootstrap(){
        await this.actorManager.bootstrap();
        
        //todo 单独抽函数
        this.masterRedisClient = await this.redisManager.client();

        let subscribeRedisClient = await this.redisManager.getDefaultSubscribeClient();

        // Logger.log('Subscribe ACTORS_CONFIG_UPDATED event','Application');
        subscribeRedisClient.subscribe('ACTORS_CONFIG_UPDATED',function(err,count){
            if(err){
                Logger.error(new Error(err));
            }
        })
        subscribeRedisClient.on('message',async (channel, message)=>{
            if(channel == 'ACTORS_CONFIG_UPDATED'){
                Logger.log('........Actor Manager Restart........','Application');
                await this.actorManager.closeCoordinators();
                await this.actorManager.shutdown();
                await this.actorManager.bootstrap();
                await this.setUiQueue();
            }
        })
    }
    async reload(){
        await this.config.load_actors_config();
        await this.actorConfigManager.saveConfigFileToMasterRedis();
        await this.actorConfigManager.loadRemoteActorsConfig();
        await this.publishGlobalEventActorsConfigChange();
    }

    async publishGlobalEventActorsConfigChange(){
        this.masterRedisClient.publish('ACTORS_CONFIG_UPDATED',Date.now().toString());
    }

    async processShutdown(){
        Logger.log('ActorManager coordinator close.......','Application');
        await this.actorManager.closeCoordinators();//先关闭queue，不释放actor的资源，防止http server那边还在使用
    }

    async resourceShutdown(){
        Logger.log('ActorManager shutdown.......','Application');
        await this.actorManager.shutdown();
        Logger.log('MasterModels shutdown.......','Application');
        await this.masterModels.shutdown();
        Logger.log('RedisManager shutdown.......','Application');
        await this.redisManager.shutdown();

    }
    
    async setUiQueue(){//TODO 自己开发ui后移除
        
        let queues = [];
        this.actorManager.actors.forEach((actor)=>{
            queues.push(actor.coordinator.getQueue());
        })
        setQueues(queues);
    }
}
