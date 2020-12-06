import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";
import { BusinessException } from "../../Exceptions/BusinessException";
import { AppLogger as Logger} from '../../Handlers/AppLogger';
import { redisCustomCommand } from "./RedisCustomCommand";
import { Application } from "../../Application";
import { ApplicationStatus } from "../../Constants/ApplicationConstants";
const timeout = ms => new Promise(res => setTimeout(res, ms))

@Injectable()
export class RedisManager {
    public application:Application;
    private clients:Object = {}; //TODO 改为用map存

    constructor(private config:Config){
    }

    public setApplication(application:Application){
        this.application = application;
    }

    public async client(name?:string,originName?:string):Promise<RedisClient>
     {
        name = name? name : this.config.system.default;
        
        if(this.clients[name]){
            return this.clients[name];
        }
        

        originName = originName ? originName : name;
        
        let opionts = this.getClientOptions(name,originName);
        let client = new RedisClient(opionts);
        await redisCustomCommand(client);

        return new Promise((res,rej)=>{
            client.on('reconnecting',()=>{
                Logger.error(`redis client reconnecting (${name})`,null,`RedisManager`);
            })
            client.on('connect',()=>{
                Logger.debug(`redis client connect (${name})`,`RedisManager`);
            })
            client.on('close',()=>{
                Logger.log(`redis client close (${name})`,`RedisManager`);
            })
            client.on('ready',()=>{
                this.clients[name]  = client;
                res(client);
            })
            client.on('error', (error) => {
                Logger.error(`redis client error (${name}) ${error?.message}`,null,`RedisManager`);
                if(!this.clients[name]){ //启动的时候创建连接失败，直接退出程序, 程序已经启动的情况，只打印错误，等待重新连接
                    process.exit(); //todo:: 这里需要重新考虑
                }
                // rej(new Error(error))
            });
            client.on('end', () => {
                Logger.debug(`redis client end (${name}).`,`RedisManager`);
            });
        })
    }
    

    public getClientOptions(name,originName?){
        originName = originName? originName : this.config.system.default;
        let redisOptions = this.config.system.redis[originName];
        if(!redisOptions){
            throw new BusinessException('redis not exists')
        }
        redisOptions.name = name;
        redisOptions.maxRetriesPerRequest = null;

        redisOptions.retryStrategy = (times)=>{
            const delay = Math.min(times*100, 1000 * 5);
            Logger.warn(`Reids client (${name}) redis retryStrategy ${times}-${(times-1)*100 + 10}.`,`RedisManager`)
            if(this.application.status == ApplicationStatus.SHUTDOWN){
                return null;
            }
            return delay;
        }

        return redisOptions;
    }

    public async close(name:string = 'default'){
        if(this.clients[name]){
            await this.clients[name].quit()
            delete this.clients[name];
        }
    }
    public async closeAll(){
        await timeout(50);
        for (const key in this.clients) {
            await this.close(key);
        }
    }
    // public async quitAllDb(){ //TODO remove to use closeAll
    //     await timeout(1);
    //     for (const key in this.clients) {
    //        let redisClient:RedisClient =  this.clients[key];
    //        if(redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
    //             await redisClient.quit();
    //         }
    //     }
    // }

    async shutdown(){
        await this.closeAll();
    }

    public async flushAllDb(){
        for (const redisName in this.config.system.redis) {
            let redisClient:RedisClient =  await this.client(redisName);
            await redisClient.flushdb();
            Logger.debug(`Flushdb: ${redisName}.`,'RedisManager')
        }
    }
    


}