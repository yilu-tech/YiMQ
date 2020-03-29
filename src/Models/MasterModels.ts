import { Injectable, Inject } from "@nestjs/common";
import { NohmClass, IStaticMethods, NohmModel } from "nohm";
import { ActorModelClass } from "./ActorModel";
import { ListenerModelClass } from "./ListenerModel";


@Injectable()
export class MasterModels {
    public ActorModel:IStaticMethods<ActorModelClass> ;
    public ListenerModel:IStaticMethods<ListenerModelClass>
    constructor(@Inject('masterNohm') private masterNohm:NohmClass){
        this.ActorModel  = masterNohm.register(ActorModelClass);
        this.ListenerModel = masterNohm.register(ListenerModelClass);
        
    }
}