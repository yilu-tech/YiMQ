import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './ExceptionFilters/BusinessExceptionFilter';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SystemExceptionFilter } from './ExceptionFilters/SystemExceptionFilter';
import { ValidationException } from './Exceptions/ValidationException';
import { CoordinatorRequestExceptionFilter } from './ExceptionFilters/CoordinatorRequestExceptionFilter';
import { Config } from './Config';
import { Transport } from '@nestjs/microservices';
import { join } from 'path';

const port = 7379;
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }));
    app.enableShutdownHooks();
  
    app.enableCors();
  app.useGlobalPipes(new ValidationPipe({
    transform:true,
    exceptionFactory:(errors)=>{
      return new ValidationException(errors);
    }
  }));
  
  app.useGlobalFilters(
    new BusinessExceptionFilter(),
    new SystemExceptionFilter(),
    new CoordinatorRequestExceptionFilter
    );

  let config = await app.get<Config>(Config).loadConfig();

  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'YiMQ',
      protoPath: join(process.cwd(), 'protos/yimq.proto'),
      url: `0.0.0.0:8379`,
    },
  })

  await app.startAllMicroservicesAsync();

  try {
    await app.listen(config.system.port,'0.0.0.0'); 
  } catch (error) {
    console.error("main.ts",error)
  }
  // console.info(`..........................................Port: ${config.system.port}..........................................`);
  Logger.log(`Port: ${config.system.port}`,'Main')
  
}
bootstrap();