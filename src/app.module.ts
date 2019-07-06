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
    RedisManager,
    CoordinatorDao,
    RedisDao,
    ModelFactory,
    {
      provide: 'CoordinatorManager',
      useFactory: async(config:Config,redisManager:RedisManager,coordinatorDao:CoordinatorDao)=>{
        const coordinatorManager = new CoordinatorManager(config,redisManager,coordinatorDao);
        await coordinatorManager.initCoordinators();
        await coordinatorManager.bootstrapCoordinatorsProcesser();
        return coordinatorManager;
      },
      inject:[Config,RedisManager,CoordinatorDao]
    },
  ],
})
export class AppModule {}
