import { Injectable } from "@nestjs/common";

import { Config } from "../../Config";
import * as Ioredis from 'ioredis'
import { RedisClient } from "./RedisClient";



@Injectable()
export class RedisManager {
    private clients:Object = {};

    constructor(private config:Config){
    }

    public client(name:string = 'default'):RedisClient
     {
        if(this.clients[name]){
            return this.clients[name];
        }
        this.clients[name] = new Ioredis(this.getClientConfig(name));
        return this.clients[name];
    }

    private getClientConfig(name){
        if(name === 'default'){
            return this.config.system.redis;
        }
    }

    public async close(name:string = 'default'){
        if(this.clients[name]){
            await this.clients[name].quit()
            delete this.clients[name];
        }
    }


}