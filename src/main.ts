import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './ExceptionFilters/BusinessExceptionFilter';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SystemExceptionFilter } from './ExceptionFilters/SystemExceptionFilter';
import { ValidationException } from './Exceptions/ValidationException';
import { CoordinatorRequestExceptionFilter } from './ExceptionFilters/CoordinatorRequestExceptionFilter';
const { UI } = require('bull-board');

const port = 7379;
async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter({ logger: true }),{
  });
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
  await app.listen(port,'0.0.0.0');
  
  if(process.send){
    process.send('ready');//pm2优雅启动
    console.info(`YiMQ listening on port ${port}!`);
  }


  //TODO remove
  var express = require('express');
  var uiApp = express();
  uiApp.use('/',UI);
  uiApp.listen(7380, function () {
    console.info('Ui app listening on port 7380!');
  });
  
}
bootstrap();
