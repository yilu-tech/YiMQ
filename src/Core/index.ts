import { CoordinatorDao } from "./Coordinator/CoordinatorDao";
import { Config } from "../Config";
import { RedisManager } from "../Handlers/redis/RedisManager";
import { CoordinatorManager } from "./CoordinatorManager";


export const coreInjects = [
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
];