import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";



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
        return this.config.system.redis[name];
    }

    public async close(name:string = 'default'){
        if(this.clients[name]){
            await this.clients[name].quit()
            delete this.clients[name];
        }
    }


}