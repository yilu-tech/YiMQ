import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Config } from '../Config';
import { RedisManager } from '../Handlers/redis/RedisManager';

import { MasterModels } from '../Models/MasterModels';
import { ActorManager } from '../Core/ActorManager';
import { ActorService } from '../Services/ActorService';
import { MessageService } from '../Services/MessageService';
import { JobService } from '../Services/JobService';
import { ActorConfigManager } from '../Core/ActorConfigManager';


export const services = [
  ActorService,
  MessageService,
  JobService
] 



@Module({
  imports: [],
  controllers: [
  ],
  providers: [
    Config,
    RedisManager,
    MasterModels,
    ActorConfigManager,
    ActorManager,
    ...services
  ],
})
export class CommandModule {
}
