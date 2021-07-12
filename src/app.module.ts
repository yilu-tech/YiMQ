import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Config } from './Config';
import { RedisManager } from './Handlers/redis/RedisManager';

import { MasterModels } from './Models/MasterModels';
import { ActorManager } from './Core/ActorManager';
import { MessagesController } from './Controllers/MessageController';
import { IndexController } from './Controllers/IndexController';
import { AdminController } from './Controllers/AdminController';
import { SwitchMiddleware } from './Middlewares/SwitchMiddleware';
import { Application } from './Application';
import { ActorService } from './Services/ActorService';
import { MessageService } from './Services/MessageService';
import { JobService } from './Services/JobService';
import { ActorConfigManager } from './Core/ActorConfigManager';
import { AdminService } from './Services/AdminService';
import { ContextLogger } from './Handlers/ContextLogger';
import { Database } from './Database';

export const services = [
  ActorService,
  MessageService,
  JobService,
  AdminService
] 



@Module({
  imports: [],
  controllers: [
    MessagesController,
    IndexController,
    AdminController
  ],
  providers: [
    Database,
    Application,
    Config,
    ContextLogger,
    RedisManager,
    MasterModels,
    ActorConfigManager,
    ActorManager,
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
