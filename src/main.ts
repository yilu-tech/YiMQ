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



async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter(),{
  });
  app.useGlobalPipes(new ValidationPipe({
    exceptionFactory:(errors)=>{
      return new ValidationException(errors);
    }
  }));
  app.useGlobalFilters(new BusinessExceptionFilter(),new SystemExceptionFilter());
  await app.listen(7379,'0.0.0.0');
}
bootstrap();
