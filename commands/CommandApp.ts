

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

    async initConfig(){
        this.context = await NestFactory.createApplicationContext(CommandModule);
        this.config =  await this.context.get<Config>(Config).loadConfig();
        return this;
    }
    async initContext(){

        this.redisManager = this.context.get<RedisManager>(RedisManager);
        this.actorManager = this.context.get<ActorManager>(ActorManager);
        this.masterModels = this.context.get<MasterModels>(MasterModels);



        await this.masterModels.register();
        await this.actorManager.bootstrap(false);
        return this;
    }

    async closeContext(){
        await this.actorManager.shutdown();
        await this.masterModels.shutdown();
        await this.redisManager.shutdown();
    }

}