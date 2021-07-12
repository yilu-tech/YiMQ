import { Injectable, OnApplicationShutdown, OnApplicationBootstrap, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { MasterModels } from './Models/MasterModels';
import { ActorManager } from './Core/ActorManager';
import { RedisManager } from './Handlers/redis/RedisManager';
import { RedisClient } from './Handlers/redis/RedisClient';
import { Config } from './Config';
import { ActorConfigManager } from './Core/ActorConfigManager';
import {AppLogger as Logger} from './Handlers/AppLogger';
import { ApplicationStatus } from './Constants/ApplicationConstants';
import { BusinessException } from './Exceptions/BusinessException';
import { timeout } from './Handlers';
import { ContextLogger } from './Handlers/ContextLogger';
import { Database } from './Database';
let pacakage = require('../package.json');
@Injectable()
export class Application implements OnApplicationShutdown,OnApplicationBootstrap,OnModuleInit{
    public version:string;
    public masterRedisClient:RedisClient;
    public status:ApplicationStatus;
    private startingUpTime:number;
    private shutdownTime:number;
    constructor(
        public redisManager:RedisManager, 
        public masterModels:MasterModels, 
        public actorConfigManager:ActorConfigManager,
        public actorManager:ActorManager,
        public config:Config,
        public contextLogger:ContextLogger,
        public database:Database
        ){
        this.actorManager.setApplication(this);
        this.redisManager.setApplication(this);
        this.version = pacakage.version;
    }
    async onModuleInit() {
        this.startingUpTime = Date.now();
        console.info('..........................................Starting Up..........................................');
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
    
    
    async onApplicationShutdown(signal?: string) {
        this.status = ApplicationStatus.SHUTDOWN;
        this.shutdownTime = Date.now();
        console.info('..........................................Shutdown..........................................');
        if(this.masterRedisClient && this.masterRedisClient.status == 'ready'){
            await this.shutdown()
            await timeout(50);
        }
        let costTime = (Date.now() - this.shutdownTime)/1000;
        console.info(`..........................................Shutdown: ${costTime}s..........................................\n`);
        // process.exit(0);//框架自己有发出信号，这里不需要手动
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
        await this.database.init();
        await this.masterModels.register()
        await this.actorConfigManager.saveConfigFileToMasterRedis()
    }
    async bootstrap(){
        await this.baseBootstrap();
        await this.actorManagerBootstrap();
    }
    async actorManagerBootstrap(){
        await this.actorManager.bootstrap();
        
        //todo 单独抽函数
        this.masterRedisClient = await this.redisManager.client();

        let subscribeRedisClient = await this.redisManager.client('app_subscribe',this.config.system.default);

        // Logger.log('Subscribe ACTORS_CONFIG_UPDATED event','Application');
        subscribeRedisClient.subscribe('ACTORS_CONFIG_UPDATED',function(err,count){
            if(err){
                Logger.error(new Error(err.message));
            }
        })
        subscribeRedisClient.on('message',async (channel, actorName)=>{
            if(channel == 'ACTORS_CONFIG_UPDATED'){
                Logger.log('........Actor Manager Restart........','Application');
                this.status = ApplicationStatus.RELOADING;
                try {
                    await this.actorManager.reload(actorName);
                } catch (error) {
                    Logger.error(error.message,null,"Application Reload");
                }
        
                this.status = ApplicationStatus.RUNNING;
            }
        })
    }
    async reload(actorName){
        if(this.status == ApplicationStatus.RELOADING){
            let message = 'applicaton is reloading...'
            Logger.error(message,null,'Application');
            throw new BusinessException(message);
        }
        await this.config.load_actors_config();
        await this.actorConfigManager.saveConfigFileToMasterRedis();
        await this.publishGlobalEventActorsConfigChange(actorName);
    }

    async publishGlobalEventActorsConfigChange(actorName){
        this.masterRedisClient.publish('ACTORS_CONFIG_UPDATED',actorName);
    }



    async shutdown(){
        Logger.log('ActorManager shutdown.......','Application');
        await this.actorManager.shutdown();
        Logger.log('MasterModels shutdown.......','Application');
        await this.masterModels.shutdown();
        Logger.log('RedisManager shutdown.......','Application');
        await this.redisManager.shutdown();
        await this.database.close()

    }

    getVersion(){
        return this.version;
    }
}
