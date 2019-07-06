import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionController } from './Controllers/TransactionController';
import { JobController } from './Controllers/JobController';
import { Config } from './Config';
import { RedisManager } from './Handlers/redis/RedisManager';
import { CoordinatorManager } from './Core/CoordinatorManager';
import { CoordinatorController } from './Admin/CoordinatorAdminController';
import { CoordinatorDao } from './Core/Coordinator/CoordinatorDao';
import { adminControllers } from './Admin';
import { RedisDao } from './Handlers/redis/ReidsDao';
import { ModelFactory } from './Handlers/ModelFactory';
import { ActorService } from './Services/ActorService';
import { services } from './Services';
import { handlerInjects } from './Handlers';
import { coreInjects } from './Core';
// import { QueueService } from './modules/queue/queue.service';



@Module({
  imports: [],
  controllers: [
    AppController,
    TransactionController,
    JobController,
    CoordinatorController,
    ...adminControllers
  ],
  providers: [
    AppService,
    Config,
    ...handlerInjects,
    ...coreInjects,
    ...services,
  ],
})
export class AppModule {}
