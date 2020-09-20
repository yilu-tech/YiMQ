

import { NestFactory } from '@nestjs/core';
import { CommandModule } from './CommandModule'
import { INestApplicationContext } from '@nestjs/common';
import { Config } from '../src/Config';
import { ActorManager } from '../src/Core/ActorManager';
import { MasterModels } from '../src/Models/MasterModels';
import { RedisManager } from '../src/Handlers/redis/RedisManager';


export class App{
    public context:INestApplicationContext
    public config:Config;
    public actorManager:ActorManager;
    public masterModels:MasterModels;
    public redisManager:RedisManager;
    async init(){
        this.context = await NestFactory.createApplicationContext(CommandModule);
        this.config =  this.context.get<Config>(Config);
        this.redisManager = this.context.get<RedisManager>(RedisManager);
        this.actorManager = this.context.get<ActorManager>(ActorManager);
        this.masterModels = this.context.get<MasterModels>(MasterModels);
        



        this.config.loadConfig()
        await this.masterModels.register();
        await this.actorManager.initActors();
    }

    async close(){
        
        await this.masterModels.shutdown();
        await this.actorManager.closeCoordinators();
        await this.actorManager.shutdown();
        await this.redisManager.shutdown();
    }

}