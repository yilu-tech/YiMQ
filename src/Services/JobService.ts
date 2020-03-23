
import { Injectable } from "@nestjs/common";
import { ActorManager } from "../Core/ActorManager";
import { SystemException } from "../Exceptions/SystemException";

@Injectable()
export class JobService {
    constructor(private actorManger:ActorManager){

    }

    async list(actor_id){
        let producer = this.actorManger.getById(actor_id);
        if(!producer){
            throw new SystemException(`Actor <${actor_id}> not exists.`)
        }
        await producer.coordinator.getQueue().getJobs([]);
    }
    
}