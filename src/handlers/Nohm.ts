import { Injectable } from "@nestjs/common";
import { RedisManager } from "./redis/RedisManager";
import { RedisClient } from "./redis/RedisClient";
import  {nohm} from 'nohm';

@Injectable()
export class Nohm {

    protected client:RedisClient;
    constructor(protected redisManager:RedisManager){
        this.client = this.redisManager.client();
        this.client.on('ready',()=>{
            nohm.setClient(this.client);
            console.info('Nohm inited.')
        })


    }
    
}


