
import { RedisManager } from "../Handlers/redis/RedisManager";
import { NohmClass, IStaticMethods } from "nohm";
import { Redis } from "ioredis";
import { Coordinator } from "./Coordinator/Coordinator";
import { HttpCoordinator } from "./Coordinator/HttpCoordinator";
import { GrpcCoordinator } from "./Coordinator/GrpcCoordinator";
import { MessageModelClass } from "../Models/MessageModel";
import { MessageManager } from "./MessageManager";
import { JobManager } from "./JobManager";
import { ActorManager } from "./ActorManager";
import { SubtaskModelClass } from "../Models/SubtaskModel";
import { CoordinatorCallActorAction } from "../Constants/Coordinator";
import {differenceBy} from 'lodash';
import { ActorStatus } from "../Constants/ActorConstants";
import { HttpCoordinatorRequestException } from "../Exceptions/HttpCoordinatorRequestException";
import {SubtaskManager} from './SubtaskManager';
import { ActorModelClass } from "../Models/ActorModel";
import { SystemException } from "../Exceptions/SystemException";
import { ActorOptions } from "../Config/ActorConfig";
import { ActorCleaner } from "./ActorCleaner";
import { AppLogger } from "../Handlers/AppLogger";

export class Actor{
    public id:number;
    public name:string;
    public key:string;
    public api:string;
    public options:ActorOptions;
    public redis:string;
    public protocol:string;
    public status:ActorStatus

    

    public coordinator:Coordinator;

    public redisClient:Redis;
    private nohm: NohmClass;
    public messageModel:IStaticMethods<MessageModelClass> ;
    public subtaskModel:IStaticMethods<SubtaskModelClass>
    public messageManager:MessageManager;
    public jobManager:JobManager;
    public subtaskManager:SubtaskManager
    private model:ActorModelClass
    public actorCleaner:ActorCleaner;

    constructor(public actorManager:ActorManager,private redisManager:RedisManager){

    }
    setModel(actorModel){
        this.id = actorModel.property('id');
        this.name = actorModel.property('name');
        this.key = actorModel.property('key');
        this.api = actorModel.property('api');
        this.options = actorModel.property('options'); //TODO add headers
        this.redis = actorModel.property('redis');
        this.protocol = actorModel.property('protocol');
        this.status = <ActorStatus>actorModel.property('status');
        this.model = actorModel;
    }
    public async init(){
        AppLogger.debug(`Init actor: ${this.name}.`,'Actor')
        this.redisClient = await this.redisManager.client(this.redis);
        this.messageManager = new MessageManager(this);
        this.actorCleaner = new ActorCleaner(this);
        this.jobManager = new JobManager(this);
        this.subtaskManager = new SubtaskManager(this);
        this.initCoordinator();
        this.initNohm();
    }
    private initNohm(){
        this.nohm = new NohmClass({});
        this.nohm.setClient(this.redisClient);
        this.messageModel = this.nohm.register(MessageModelClass)
        this.subtaskModel = this.nohm.register(SubtaskModelClass)
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



    // public async close(){
    //     await this.coordinator.close();
    //     // if(this.redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
    //     //     await this.redisClient.quit();
    //     // }
        
    // }

    public suspend(){

    }

    public unsuspend(){

    }

    public delete(force:boolean = false){
        
    }

}


