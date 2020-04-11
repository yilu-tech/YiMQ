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
import { join } from 'path';
import { Transport } from '@nestjs/microservices/enums/transport.enum';
import { async } from 'rxjs/internal/scheduler/async';
import { createInterface } from 'readline';
const { UI } = require('bull-board');



async function bootstrap() {
  const port = 7379;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),{
      
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



  
  app.connectMicroservice({
    transport: Transport.GRPC,
    options: {
      package: 'YiMQ',
      protoPath: join(process.cwd(), 'protos/yimq.proto'),
      url: `0.0.0.0:8379`,
    },
  })
  await app.startAllMicroservicesAsync();
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



async function client(){
  console.log('client');
  // require('./Client')
}
if(process.env.mode == 'client'){
  client()
}else{
  bootstrap();
}




