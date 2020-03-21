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







export const modelsInjects=[
  MasterModels
]

export const ActorManagerBootstrap = {
  provide: 'ActorManagerBootstrap',
  useFactory: async(actorManager:ActorManager)=>{
    await actorManager.initActors();
    await actorManager.bootstrapActorsCoordinatorprocessor();
  },
  inject:[ActorManager]
}



@Module({
  imports: [],
  controllers: [
    MessagesController,
    IndexController
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
