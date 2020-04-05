import { Injectable, Inject } from "@nestjs/common";
import { NohmClass, IStaticMethods, NohmModel } from "nohm";
import { ActorModelClass } from "./ActorModel";
import { ListenerModelClass } from "./ListenerModel";
import { RedisManager } from "../Handlers/redis/RedisManager";


@Injectable()
export class MasterModels {
    public ActorModel:IStaticMethods<ActorModelClass> ;
    public ListenerModel:IStaticMethods<ListenerModelClass>
    public masterNohm:NohmClass;
    constructor(private redisManager:RedisManager){
        
    }
    public async register(){
        let redisClient = await this.redisManager.client();
        this.masterNohm = new NohmClass({})
        this.masterNohm.setClient(redisClient);
        this.ActorModel  = this.masterNohm.register(ActorModelClass);
        this.ListenerModel = this.masterNohm.register(ListenerModelClass);
    }
    public async shutdown(){
        if(this.masterNohm){
            this.masterNohm.closePubSub();
        }
        
        delete this.ActorModel;
        delete this.ListenerModel;
        delete this.masterNohm;
    }
}