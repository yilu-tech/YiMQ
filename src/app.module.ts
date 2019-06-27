import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TransactionController } from './controllers/TransactionController';
import { JobController } from './controllers/JobController';
import { Config } from './config';
import { RedisManager } from './handlers/redis';
import { CoordinatorManager } from './services';
import { CoordinatorController } from './admin/CoordinatorAdminController';
import { CoordinatorDao } from './services/coordinator/CoordinatorDao';
import { adminControllers } from './admin';


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
