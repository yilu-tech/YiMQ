import { Injectable } from "@nestjs/common";
import { Application } from "../Application";
import { ActorService } from "./ActorService";
import * as os from 'os';
@Injectable()
export class AdminService{
    constructor(
        private actorService:ActorService,
        private application:Application
        ){

    }

    async home(){

        let actors = await this.actorService.list();

        let master_redis = await this.application.masterRedisClient.getInfo();

        //todo: 用数组，以后多server的时候定时写到redis，从redis获取
        let servers = [
            {
                cpus: os.cpus(),
                loadavg: os.loadavg(),
                totalmem: os.totalmem(),
                freemem: os.freemem(),

            }
        ]

        return {
            version: this.application.getVersion(),
            master_redis,
            servers,
            actors,
        };

    }

}


