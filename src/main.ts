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

const { UI } = require('bull-board');

const port = 7379;
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }));
    app.enableShutdownHooks();

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

  await app.listen(config.system.port,'0.0.0.0');
  // console.info(`..........................................Port: ${config.system.port}..........................................`);
  Logger.log(`Port: ${config.system.port}`,'Main')
  


  //TODO remove
  var express = require('express');
  var uiApp = express();
  uiApp.use('/',UI);
  uiApp.listen(7380, function () {
  });
  
}
bootstrap();
