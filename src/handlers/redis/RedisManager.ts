import { Injectable } from "@nestjs/common";

import { Config } from "../../config";
import Ioredis from 'ioredis'
import { RedisInstance } from "./RedisInstance";



@Injectable()
export class RedisManager {
    private instances:Object = {};

    constructor(private config:Config){
    }

    public instance(name:string = 'default'):RedisInstance
     {
        if(this.instances[name]){
            return this.instances[name];
        }
        this.instances[name] = new RedisInstance(new Ioredis(this.getClientConfig(name)));
        return this.instances[name];
    }

    private getClientConfig(name){
        if(name === 'default'){
            return this.config.system.redis;
        }
    }

    public async close(name:string = 'default'){
        if(this.instances[name]){
            await this.instances[name].quit()
            delete this.instances[name];
        }
    }


}