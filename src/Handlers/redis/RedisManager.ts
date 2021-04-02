import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";
import { BusinessException } from "../../Exceptions/BusinessException";
import { AppLogger as Logger} from '../../Handlers/AppLogger';
import { redisCustomCommand } from "./RedisCustomCommand";
import { Application } from "../../Application";
import { ApplicationStatus } from "../../Constants/ApplicationConstants";
import { basename, extname, join } from "path";
import { readdirSync, readFileSync } from "fs";
const timeout = ms => new Promise(res => setTimeout(res, ms))

@Injectable()
export class RedisManager {
    public application:Application;
    private clients:Object = {}; //TODO 改为用map存
    public scripts:{name:string,numberOfKeys:number,lua:string}[] = [];

    constructor(private config:Config){
        this.loadScripts();
    }

    loadScripts(){
        let scriptsPath = join(__dirname,'scripts');
        let scripts = readdirSync(scriptsPath);
        for(let scriptFilename of scripts){
            if(extname(scriptFilename)){
                let [name,numberOfKeys] = basename(scriptFilename,extname(scriptFilename)).split('-');
                let scriptPath = join(scriptsPath,scriptFilename);
                let lua = readFileSync(scriptPath,'utf-8')
                this.scripts.push({
                    name:name,
                    numberOfKeys:Number(numberOfKeys),
                    lua:lua
                })
            }
        }
    }


    public setApplication(application:Application){
        this.application = application;
    }

    public async client(name?:string,optionName?:string):Promise<RedisClient>
     {
        name = name? name : this.config.system.default;
        
        if(this.clients[name]){
            return this.clients[name];
        }
        

        optionName = optionName ? optionName : name;
        
        let opionts:Ioredis.RedisOptions = {
            ...this.getClientOptions(optionName),
            ...this.getReconnectOptions(name),
            connectionName: name
        }
        let client = new RedisClient(opionts);
        await client.defineCommands(this)
        await redisCustomCommand(client);

        return new Promise((res,rej)=>{
            client.on('reconnecting',()=>{
                Logger.error(`redis client reconnecting (${name})`,null,`RedisManager`);
            })
            client.on('connect',()=>{
                Logger.debug(`redis client connect (${name})`,`RedisManager`);
            })
            // client.on('close',()=>{
            //     Logger.log(`redis client close (${name})`,`RedisManager`);
            // })
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
    

    public getClientOptions(name?){
        name = name? name : this.config.system.default;
        let redisOptions = this.config.system.redis[name];
        if(!redisOptions){
            throw new BusinessException('redis not exists')
        }
        return redisOptions;
    }

    public getReconnectOptions(name:string){
        let options:Ioredis.RedisOptions = {
            maxRetriesPerRequest: null
        }

        options.retryStrategy = (times)=>{
            const delay = Math.min(times*100, 1000 * 5);
            Logger.log(`Reids client (${name}) redis retryStrategy ${times}-${(times-1)*100 + 10}.`,`RedisManager`)
            if(this.application.status == ApplicationStatus.SHUTDOWN){
                return null;
            }
            return delay;
        }

        if(name.includes('bclient') ){
            options.enableReadyCheck = false; //需要设置为false,否则redis重新链接后，process不会继续处理，参考: https://github.com/OptimalBits/bull/issues/890
            options.reconnectOnError = (err) =>{ //enableReadyCheck=false 的时候，导致redis还在恢复数据到内存的时候，命令已经发送，导致错误 https://github.com/luin/ioredis/issues/358
                // Logger.log(`(${name}) ${err.message}`,`RedisManager`);
                if (err.message.includes("LOADING")) {
                    return 2;
                }
            }
        }
        
        return options;

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