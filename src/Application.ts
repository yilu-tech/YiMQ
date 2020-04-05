import { Injectable } from '@nestjs/common';
import { MasterModels } from './Models/MasterModels';
import { ActorManager } from './Core/ActorManager';
const { setQueues } = require('bull-board')
@Injectable()
export class Application {
    constructor(public masterModels:MasterModels, public actorManager:ActorManager){

    }

    private online = true;

    public setOnline(){
        this.online = true;
    }
    public setOffline(){
        this.online = false;
    }
    public isOnline(){
        return this.online;
    }

    async baseBootstrap(){
        await this.masterModels.register()
        await this.actorManager.saveConfigFileToMasterRedis()
        await this.actorManager.initActors();
        
    }
    async bootstrap(){
        await this.baseBootstrap();
        await this.actorManager.loadActorsRemoteConfig();  
        await this.actorManager.bootstrapActorsCoordinatorprocessor();
    
        await this.setUiQueue();
    }

    async shutdown(){
        await this.masterModels.shutdown();
        await this.actorManager.shutdown();
    }
    
    async setUiQueue(){//TODO 自己开发ui后移除
        
        let queues = [];
        this.actorManager.actors.forEach((actor)=>{
            queues.push(actor.coordinator.getQueue());
        })
        setQueues(queues);
    }
}
