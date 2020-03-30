
import { ActorService } from "./Services/ActorService";
import  {NohmClass} from 'nohm';
import { RedisManager } from "./Handlers/redis/RedisManager"
import { ActorManager } from "./Core/ActorManager";
const { setQueues } = require('bull-board')

export const ConfigToMasterRedis = {
    provide: 'configToMasterRedis',
    useFactory: async (actorService:ActorService) => {
        await actorService.loadConfigFileToMasterRedis();
    },
    inject:[ActorService]
}





/**
 * 配置masterNohm注入redis client
 */
export const MasterNohm = {
  provide: 'masterNohm',
  useFactory: async (redisManager:RedisManager) => {
    let redisClient = await redisManager.client();
    const defaultNohm = new NohmClass({})
    defaultNohm.setClient(redisClient);
    return defaultNohm;
  },
  inject:[RedisManager]
}

export const ActorManagerBootstrap = {
  provide: 'ActorManagerBootstrap',
  useFactory: async(actorManager:ActorManager)=>{
    await actorManager.initActors();
    await actorManager.loadActorsRemoteConfig();
    await actorManager.bootstrapActorsCoordinatorprocessor();

    //TODO 自己开发ui后移除
    let queues = [];
    actorManager.actors.forEach((actor)=>{
        queues.push(actor.coordinator.getQueue());
    })
    setQueues(queues);
  },
  inject:[ActorManager]
}

