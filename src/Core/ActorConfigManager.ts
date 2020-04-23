import { Injectable } from "@nestjs/common";
import { Config } from "../Config";
import { RedisManager } from "../Handlers/redis/RedisManager";
import { MasterModels } from "../Models/MasterModels";
import { CoordinatorCallActorAction } from "../Constants/Coordinator";
import { SystemException } from "../Exceptions/SystemException";
import {differenceBy} from 'lodash';
import axios from 'axios';
import { HttpCoordinatorRequestException } from "../Exceptions/HttpCoordinatorRequestException";
import { ActorStatus } from "../Constants/ActorConstants";
import { ActorConfig } from "../Config/ActorConfig";
import {AppLogger as Logger} from '../Handlers/AppLogger';

@Injectable()
export class ActorConfigManager{
    constructor(public config:Config,private redisManager:RedisManager,public masterModels:MasterModels){

    }

    public async getByName(name){
        let result = await this.masterModels.ActorModel.findAndLoad({
            name: name
        })
        let actor = <ActorConfig>result[0].allProperties();
        return actor;
    }

    public async saveConfigFileToMasterRedis(){
        Logger.log('Save actors config to master redis.','ActorConfigManager');
        let actorsConfig = this.config.actors;

        let actorModels = await this.getAllActorModels();
 
        let removeActorModels = actorModels.filter((item)=>{
            for(let actorConfig of actorsConfig){
                if(Number(item.id) == Number(actorConfig.id)){
                    return false;
                } 
            }
            return true;
        })

        for (const removeActorModel of removeActorModels) {
            removeActorModel.property('status',ActorStatus.REMOVED)
            await removeActorModel.save()
            Logger.warn(removeActorModel.allProperties(),'ActorConfigManager Actor_Remove');
        }

        
        for(let actorConfig of actorsConfig){


            let actorModel = (await this.masterModels.ActorModel.findAndLoad({
                id: actorConfig.id
            }))[0]
            
            if(actorModel){
                Logger.debug(`${actorModel.property('name')} update`,'ActorConfigManager');
            }else{
                actorModel = new this.masterModels.ActorModel();
                Logger.debug(`${actorConfig.name} add`,'ActorConfigManager');
            }
            actorModel.id = actorConfig.id;
            actorModel.property('id',actorConfig.id);
            actorModel.property('name',actorConfig.name);

            actorModel.property('key',actorConfig.key);

            actorModel.property('api',actorConfig.api);
            actorModel.property('status',ActorStatus.ACTIVE);
            actorModel.property('protocol',actorConfig.protocol);
            actorModel.property('options',actorConfig.options);
            actorModel.property('redis',actorConfig.redis);
            actorModel.property('redisOptions',this.config.system.redis[actorConfig.redis]);
            await  actorModel.save(); 
        }
        return true;
    }

    public async loadRemoteActorsConfig(){
        let actorModels = await this.getAllActorModels();
        for(let actorModel of actorModels){
            await this.loadRemoteConfigToDB(actorModel.allProperties());
        }
        Logger.log('Loaded actors remote config to db.','ActorManager')

    }
    public async callActor(actor,action,context?):Promise<any>{
        let config = {
            headers:{
                'content-type':'application/json',
                ...actor.options.headers
            }
        }
        let body = {
            action: action,
            api: actor.api,
            request_config: config,
            context: context
        };

        try {
            let result = (await axios.post(actor.api,body,config)).data;
            // Logger.debug({request:body,response:result},'ActorConfigManager call actor')
            return result;            
        } catch (error) {
            // Logger.debug({request:body},'ActorConfigManager call actor')
            throw new SystemException(error.message);
        }
    }

    public async loadRemoteConfigToDB(actor){
        try {
            let result = await this.callActor(actor,CoordinatorCallActorAction.GET_CONFIG);
            if(result.actor_name != actor.name){
                throw new SystemException(`Remote config actor_name is <${result.actor_name}>`);
            }
            await this.saveListener(actor,result['broadcast_listeners']);   
        } catch (error) {
            let errorMessage = `${error.message}`;
            if(error instanceof HttpCoordinatorRequestException){
                errorMessage = `${error.message} ${error.response.message||''} `;
            }
            Logger.error(`Actor <${actor.name}> ${errorMessage}`,undefined,`ActorConfigManager`)
        }
    }

    private async saveListener(actor,listenerOptions){
        let listenerModels = await this.masterModels.ListenerModel.findAndLoad({
            actor_id:actor.id
        });

        let listeners = listenerModels.map((item)=>{
            return item.allProperties();
        })
        let removeListeners = differenceBy(listeners, listenerOptions, 'processor');

        for (const item of removeListeners) {
            await this.masterModels.ListenerModel.remove(item.id);
            Logger.log(item,'Actor_Listener_Remove');
        }


        for (const item of listenerOptions) {
            let listenerModel;

            listenerModel = (await this.masterModels.ListenerModel.findAndLoad({
                actor_id:actor.id,
                processor: item.processor,
            }))[0];

            if(listenerModel){
                Logger.debug(`${item.processor}`,`Actor_Listener_Update <${actor.name}>`);
            }else{
                listenerModel = new this.masterModels.ListenerModel();
                Logger.log(item,'Actor_Listener_Add');
            }
            
            listenerModel.property('topic',item.topic);
            listenerModel.property('processor',item.processor);
            listenerModel.property('actor_id',actor.id);
            await listenerModel.save() 
        }
    }

    public async getAllActorModels(){
        let ids = await this.masterModels.ActorModel.sort({
            field: 'id',
            direction: 'ASC'
        },false);
        return this.masterModels.ActorModel.loadMany(ids);
    }
}