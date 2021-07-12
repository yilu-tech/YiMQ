
import { RedisManager } from "../Handlers/redis/RedisManager";
import { NohmClass, IStaticMethods } from "yinohm";
import { Coordinator } from "./Coordinator/Coordinator";
import { HttpCoordinator } from "./Coordinator/HttpCoordinator";
import { GrpcCoordinator } from "./Coordinator/GrpcCoordinator";
import { MessageModelClass } from "../Models/MessageModel";
import { MessageManager } from "./MessageManager";
import { JobManager } from "./JobManager";
import { ActorManager } from "./ActorManager";
import { SubtaskModelClass } from "../Models/SubtaskModel";
import { ActorStatus } from "../Constants/ActorConstants";
import {SubtaskManager} from './SubtaskManager';
import { ActorModelClass } from "../Models/ActorModel";
import { ActorOptions } from "../Config/ActorConfig";
import { ActorCleaner } from "./ActorCleaner";
import { AppLogger } from "../Handlers/AppLogger";
import { Exclude, Expose } from "class-transformer";
import { RedisClient } from "../Handlers/redis/RedisClient";
@Exclude()
export class Actor{
    @Expose()
    public id:number;
    @Expose()
    public name:string;
    public key:string;
    public api:string;
    public options:ActorOptions;
    public redis:string;
    public protocol:string;
    @Expose()
    public status:ActorStatus

    

    public coordinator:Coordinator;

    public redisClient:RedisClient;
    private nohm: NohmClass;
    // public messageModel:IStaticMethods<MessageModelClass> ;
    // public subtaskModel:IStaticMethods<SubtaskModelClass>
    public messageManager:MessageManager;
    public jobManager:JobManager;
    public subtaskManager:SubtaskManager
    private model:ActorModelClass
    public actorCleaner:ActorCleaner;

    constructor(public actorManager:ActorManager,public redisManager:RedisManager){

    }

    public async bootstrap() {
        await this.prepare();
        // await this.actorCleaner.setupClearJob();
        await this.process();
        
    }
    public async process(){
        await this.coordinator.processBootstrap()
    }
    public async shutdown(){
        AppLogger.log(`Actor shutdown...... （${this.name}).`,'Actor')
        await this.coordinator.close()
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
    public async init(actorModel){
        this.setModel(actorModel);
        AppLogger.log(`Actor init...... （${this.name}).`,'Actor')
        this.redisClient = await this.redisManager.client(this.redis);
        this.initNohm();
        this.messageManager = new MessageManager(this);
        this.actorCleaner = new ActorCleaner(this);
        this.jobManager = new JobManager(this);
        this.subtaskManager = new SubtaskManager(this);
        await this.initCoordinator();
        return this;
    }
    public async prepare(){
        await this.loadRemoteConfig();
        return this;
    }

    public async loadRemoteConfig(){
        await this.actorManager.actorConfigManager.loadRemoteConfigToDB(this)
    }

    private initNohm(){
        this.nohm = new NohmClass({});
        this.nohm.setClient(this.redisClient);
        // this.messageModel = this.nohm.register(MessageModelClass)
        // this.subtaskModel = this.nohm.register(SubtaskModelClass)
    }


    private async initCoordinator(){

        switch (this.protocol) {
            case 'http':
                this.coordinator = new HttpCoordinator(this);
                break;
            case 'grpc':
                this.coordinator = new GrpcCoordinator(this);
                break;
        }
        await this.coordinator.initQueue();
    }

    



    public suspend(){

    }

    public unsuspend(){

    }

    public delete(force:boolean = false){
        
    }
    
}


