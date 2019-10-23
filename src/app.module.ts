import { Module } from '@nestjs/common';
import { TransactionController } from './Controllers/TransactionController';
import { JobController } from './Controllers/JobController';
import { Config } from './Config';
import { RedisManager } from './Handlers/redis/RedisManager';
import { services } from './Services';

import { MasterModels } from './Models/MasterModels';
import { MasterNohm } from './Bootstrap/MasterNohm';
import { ConfigToMasterRedis } from './Bootstrap/ConfigToMasterRedis';
import { ActorManager } from './Core/ActorManager';
import { MessagesController } from './Controllers/MessageController';
import { MessageManager } from './Core/MessageManager';







export const modelsInjects=[
  MasterModels
]

export const ActorManagerBootstrap = {
  provide: 'ActorManagerBootstrap',
  useFactory: async(actorManager:ActorManager)=>{
    await actorManager.initActors();
    await actorManager.bootstrapActorsCoordinatorProcesser();
  },
  inject:[ActorManager]
}



@Module({
  imports: [],
  controllers: [
    MessagesController
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
