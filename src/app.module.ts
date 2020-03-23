import { Module } from '@nestjs/common';
import { Config } from './Config';
import { RedisManager } from './Handlers/redis/RedisManager';
import { services } from './Services';

import { MasterModels } from './Models/MasterModels';
import { MasterNohm } from './Bootstrap/MasterNohm';
import { ConfigToMasterRedis } from './Bootstrap/ConfigToMasterRedis';
import { ActorManager } from './Core/ActorManager';
import { MessagesController } from './Controllers/MessageController';
import { IndexController } from './Controllers/IndexController';
import { AdminController } from './Controllers/AdminController';

const { setQueues } = require('bull-board')






export const modelsInjects=[
  MasterModels
]

export const ActorManagerBootstrap = {
  provide: 'ActorManagerBootstrap',
  useFactory: async(actorManager:ActorManager)=>{
    await actorManager.initActors();
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



@Module({
  imports: [],
  controllers: [
    MessagesController,
    IndexController,
    AdminController
    // AppController,
    // TransactionController,
    // JobController,
    // CoordinatorController,
    // ...adminControllers
  ],
  providers: [
    // AppService,
    Config,
    RedisManager,
    MasterNohm,
    ConfigToMasterRedis,
    ...modelsInjects,
    ActorManager,
    ActorManagerBootstrap,
    ...services,
  ],
})
export class AppModule {}
