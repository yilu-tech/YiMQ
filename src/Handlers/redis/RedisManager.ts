import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";
import { BusinessException } from "../../Exceptions/BusinessException";
import {Logger } from '@nestjs/common';
import { redisCustomCommand } from "./RedisCustomCommand";
const timeout = ms => new Promise(res => setTimeout(res, ms))

@Injectable()
export class RedisManager {
    private clients:Object = {};

    constructor(private config:Config){
    }

    public async client(name?:string):Promise<RedisClient>
     {
        name = name? name : this.config.system.default;
        
        if(this.clients[name]){
            return this.clients[name];
        }
        let client = new Ioredis(this.getClientOptions(name));
        redisCustomCommand(client);

        return new Promise((res,rej)=>{
            client.on('ready',()=>{
                this.clients[name]  = client;
                res(client);
            })
            //todo:: client.on error rej error
        })
    }

    public getClientOptions(name?){
        name = name? name : this.config.system.default;
        let redisOptions = this.config.system.redis[name];
        if(!redisOptions){
            throw new BusinessException('redis not exists')
        }
        return redisOptions;
    }

    public async close(name:string = 'default'){
        if(this.clients[name]){
            await this.clients[name].quit()
            delete this.clients[name];
        }
    }
    public async quitAllDb(){
        await timeout(500);
        for (const key in this.clients) {
           let redisClient:RedisClient =  this.clients[key];
           if(redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
                await redisClient.quit();
            }
        }
    }

    public async flushAllDb(){
        for (const redisName in this.config.system.redis) {
            let redisClient:RedisClient =  await this.client(redisName);
            await redisClient.flushdb();
            Logger.debug(`Flushdb: ${redisName}.`,'RedisManager')
        }
    }
    


}