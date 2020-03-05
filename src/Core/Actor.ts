
import { RedisManager } from "../Handlers/redis/RedisManager";
import { NohmClass, IStaticMethods } from "nohm";
import { Redis } from "ioredis";
import { Logger } from "@nestjs/common";
import { Coordinator } from "./Coordinator/Coordinator";
import { HttpCoordinator } from "./Coordinator/HttpCoordinator";
import { GrpcCoordinator } from "./Coordinator/GrpcCoordinator";
import { MessageModelClass } from "../Models/Message";
import { MessageManager } from "./MessageManager";
import { JobManager } from "./JobManager";
import { ActorManager } from "./ActorManager";


export class Actor{
    public id:number;
    public name:string;
    public key:string;
    public api:string;
    public redis:string;
    public protocol:string;

    

    public coordinator:Coordinator;

    private redisClient:Redis;
    private nohm: NohmClass;
    public messageModel:IStaticMethods<MessageModelClass> ;
    public messageManager:MessageManager;
    public jobManager:JobManager;

    constructor(public actorManager:ActorManager,private redisManager:RedisManager){

    }
    public async init(){
        this.redisClient = await this.redisManager.client(this.redis);
        this.initNohm();
        this.initCoordinator();
        this.messageManager = new MessageManager(this);
        this.jobManager = new JobManager(this);
        Logger.log(`Inited actor: ${this.name}.`,'bootstrap')
    }
    private initNohm(){
        this.nohm = new NohmClass({});
        this.nohm.setClient(this.redisClient);
        this.messageModel = this.nohm.register(MessageModelClass)
    }

    private initCoordinator(){
        let redisOptions = this.redisManager.getClientOptions(this.redis);
        switch (this.protocol) {
            case 'http':
                this.coordinator = new HttpCoordinator(this,redisOptions);
                break;
            case 'grpc':
                this.coordinator = new GrpcCoordinator(this,redisOptions);
                break;
        }
    }

    public safeClose(){

    }

    public async close(){
        await this.coordinator.close();
        if(this.redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
            await this.redisClient.quit();
        }
        
    }

    public suspend(){

    }

    public unsuspend(){

    }

    public delete(force:boolean = false){
        
    }

}


