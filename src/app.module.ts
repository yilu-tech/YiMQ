import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Config } from './Config';
import { RedisManager } from './Handlers/redis/RedisManager';

import { MasterModels } from './Models/MasterModels';
import { MasterNohm, ActorManagerBootstrap } from './Bootstrap';
import { ConfigToMasterRedis } from './Bootstrap';
import { ActorManager } from './Core/ActorManager';
import { MessagesController } from './Controllers/MessageController';
import { IndexController } from './Controllers/IndexController';
import { AdminController } from './Controllers/AdminController';
import { SwitchMiddleware } from './Middlewares/SwitchMiddleware';
import { Application } from './Application';
import { ActorService } from './Services/ActorService';
import { MessageService } from './Services/MessageService';
import { JobService } from './Services/JobService';


export const services = [
  ActorService,
  MessageService,
  JobService
] 



@Module({
  imports: [],
  controllers: [
    MessagesController,
    IndexController,
    AdminController
  ],
  providers: [
    Application,
    Config,
    RedisManager,
    MasterNohm,
    ConfigToMasterRedis,
    MasterModels,
    ActorManager,
    ActorManagerBootstrap,
    ...services
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer){
    consumer
    .apply(SwitchMiddleware)
    .forRoutes('*')
  
  }
}
