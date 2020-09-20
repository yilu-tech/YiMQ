import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { Config } from '../src/Config';
import { RedisManager } from '../src/Handlers/redis/RedisManager';

import { MasterModels } from '../src/Models/MasterModels';
import { ActorManager } from '../src/Core/ActorManager';
import { ActorService } from '../src/Services/ActorService';
import { MessageService } from '../src/Services/MessageService';
import { JobService } from '../src/Services/JobService';
import { ActorConfigManager } from '../src/Core/ActorConfigManager';


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
