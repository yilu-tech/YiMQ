
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


export class Actor{
    public id:number;
    public name:string;
    public key:string;
    public uri:string;
    public redis:string;
    public protocol:string;

    

    public coordinator:Coordinator;

    private redisClient:Redis;
    private nohm: NohmClass;
    public messageModel:IStaticMethods<MessageModelClass> ;
    public messageManager:MessageManager;
    public jobManager:JobManager;

    constructor(private redisManager:RedisManager){

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
                this.coordinator = new HttpCoordinator(this.name,redisOptions);
                break;
            case 'grpc':
                this.coordinator = new GrpcCoordinator(this.name,redisOptions);
                break;
        }
    }

    public safeClose(){

    }

    public close(){

    }

    public suspend(){

    }

    public unsuspend(){

    }

    public delete(force:boolean = false){
        
    }

}


