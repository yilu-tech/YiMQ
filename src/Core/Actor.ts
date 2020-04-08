
import { RedisManager } from "../Handlers/redis/RedisManager";
import { NohmClass, IStaticMethods } from "nohm";
import { Redis } from "ioredis";
import { Logger} from '../Handlers/Logger';
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
        
        this.redisClient = await this.redisManager.client(this.redis);
        this.messageManager = new MessageManager(this);
        this.jobManager = new JobManager(this);
        this.subtaskManager = new SubtaskManager(this);
        this.initCoordinator();
        this.initNohm();
        Logger.log(`Inited actor: ${this.name}.`,'Actor')
    }
    private initNohm(){
        this.nohm = new NohmClass({});
        this.nohm.setClient(this.redisClient);
        this.messageModel = this.nohm.register(MessageModelClass)
        this.subtaskModel = this.nohm.register(SubtaskModelClass)
    }


    public async loadRemoteConfigToDB(){
        try {
            let result = await this.coordinator.callActor(this,CoordinatorCallActorAction.GET_CONFIG);
            if(result.actor_name != this.name){
                throw new SystemException(`Remote config actor_name is <${result.actor_name}>`);
            }
            await this.saveListener(result['broadcast_listeners']);   
        } catch (error) {
            let errorMessage = `${error.message}`;
            if(error instanceof HttpCoordinatorRequestException){
                errorMessage = `${error.message}: ${error.response.message} `;
            }
            Logger.error(errorMessage,null,`Actor <${this.name}> loadRemoteConfig`)
            this.status = ActorStatus.INACTIVE;
        }
        //TODO processor记录到db
    }
    
    private async saveListener(listenerOptions){
        let listenerModels = await this.actorManager.masterModels.ListenerModel.findAndLoad({
            actor_id:this.id
        });

        let listeners = listenerModels.map((item)=>{
            return item.allProperties();
        })
        let removeListeners = differenceBy(listeners, listenerOptions, 'processor');

        for (const item of removeListeners) {
            await this.actorManager.masterModels.ListenerModel.remove(item.id);
            Logger.log(item,'Actor_Listener_Remove');
        }


        for (const item of listenerOptions) {
            let listenerModel;

            listenerModel = (await this.actorManager.masterModels.ListenerModel.findAndLoad({
                actor_id:this.id,
                processor: item.processor,
            }))[0];

            if(listenerModel){
                Logger.log(`${item.processor}`,`Actor_Listener_Update <${this.name}>`);
            }else{
                listenerModel = new this.actorManager.masterModels.ListenerModel();
                Logger.log(item,'Actor_Listener_Add');
            }
            
            listenerModel.property('topic',item.topic);
            listenerModel.property('processor',item.processor);
            listenerModel.property('actor_id',this.id);
            await listenerModel.save() 
        }
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
        // if(this.redisClient.status == 'ready'){//已经被单独关闭的情况下，避免发生错误(主要发生在单元测试中)
        //     await this.redisClient.quit();
        // }
        
    }

    public suspend(){

    }

    public unsuspend(){

    }

    public delete(force:boolean = false){
        
    }

}


