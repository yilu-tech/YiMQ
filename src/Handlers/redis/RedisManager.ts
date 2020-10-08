import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";
import { BusinessException } from "../../Exceptions/BusinessException";
import { AppLogger as Logger} from '../../Handlers/AppLogger';
import { redisCustomCommand } from "./RedisCustomCommand";
const timeout = ms => new Promise(res => setTimeout(res, ms))

@Injectable()
export class RedisManager {
    private clients:Object = {}; //TODO 改为用map存

    constructor(private config:Config){
    }

    public async client(name?:string):Promise<RedisClient>
     {
        name = name? name : this.config.system.default;
        
        if(this.clients[name]){
            return this.clients[name];
        }
        let opionts = {
            ...this.getClientOptions(name),
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 1000 * 5);
                // Logger.log(`Reids client (${name}) redis retryStrategy ${times}.`,`RedisManager`)
                return delay;
            }
        }
        let client = new Ioredis(opionts);
        await redisCustomCommand(client);

        return new Promise((res,rej)=>{
            client.on('reconnecting',()=>{
                Logger.error(`redis client (${name}) reconnecting`,null,`RedisManager`);
            })
            client.on('connect',()=>{
                Logger.log(`redis client (${name}) connect`,`RedisManager`);
            })
            client.on('ready',()=>{
                this.clients[name]  = client;
                res(client);
            })
            client.on('error', (error) => {
                // console.error(new Error(error));    
                rej(new Error(error))
            });
            client.on('end', () => {
                Logger.log(`redis client (${name}) is end.`,`RedisManager`);
            });
        })
    }

    public getDefaultSubscribeClient(){//TODO 这里新添加的redis链接也需要管理起来，方便shutdown

        let opionts = {
            ...this.getClientOptions(),
            maxRetriesPerRequest: null,
            retryStrategy(times) {
                const delay = Math.min(times * 100, 1000 * 5);
                // Logger.log(`Reids client (SubscribeClient) redis retryStrategy ${times}.`,`RedisManager`)
                return delay;
            }
        }

        let client = new Ioredis(opionts);
        client.on('reconnecting',()=>{
            Logger.error(`redis client (Subscribe) reconnecting`,null,`RedisManager`);
        })
        client.on('connect',()=>{
            Logger.log(`redis client (Subscribe) connect`,`RedisManager`);
        })
        client.on('error', (error) => {
            Logger.error(`redis client (Subscribe) ${error.message}`,null,`RedisManager`);
        });
        return client;
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
    public async closeAll(){
        for (const key in this.clients) {
            await timeout(1);
            await this.close(key);
        }
    }
    public async quitAllDb(){ //TODO remove to use closeAll
        await timeout(1);
        for (const key in this.clients) {
           let redisClient:RedisClient =  this.clients[key];
           if(redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
                await redisClient.quit();
            }
        }
    }

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