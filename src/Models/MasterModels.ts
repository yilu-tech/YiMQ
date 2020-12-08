import { Injectable } from "@nestjs/common";
import { NohmClass, IStaticMethods, NohmModel } from "yinohm";
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
        this.masterNohm.setClient(<any>redisClient);
        this.ActorModel  = this.masterNohm.register(ActorModelClass);
        this.ListenerModel = this.masterNohm.register(ListenerModelClass);
    }
    public async shutdown(){
        if(this.masterNohm){
            this.masterNohm.closePubSub();
            delete this.masterNohm.client;
            this.masterNohm.logError = function(err){//TODO 待观察是否有用
                console.error('MasterNohm---->',err)
            }
        }
        
        delete this.ActorModel;
        delete this.ListenerModel;
        delete this.masterNohm;
    }
}