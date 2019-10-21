import { Injectable, Inject } from "@nestjs/common";
import { NohmClass, IStaticMethods, NohmModel } from "nohm";
import { ActorModelClass } from "./ActorModel";


@Injectable()
export class MasterModels {
    public ActorModel:IStaticMethods<ActorModelClass> ;
    constructor(@Inject('masterNohm') private masterNohm:NohmClass){
        this.ActorModel  = masterNohm.register(ActorModelClass);
        
    }
}