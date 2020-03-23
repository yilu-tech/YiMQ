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
const { UI } = require('bull-board');


async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter(),{
  });
  app.useGlobalPipes(new ValidationPipe({
    transform:true,
    exceptionFactory:(errors)=>{
      return new ValidationException(errors);
    }
  }));
  
  app.useGlobalFilters(new BusinessExceptionFilter(),new SystemExceptionFilter());
  await app.listen(7379,'0.0.0.0');
  //TODO remove
  var express = require('express');
  var uiApp = express();
  uiApp.use('/',UI);
  uiApp.listen(7380, function () {
    console.log('Ui app listening on port 3000!');
  });
}
bootstrap();
