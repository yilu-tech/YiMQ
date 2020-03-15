import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BusinessExceptionFilter } from './ExceptionFilters/BusinessExceptionFilter';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SystemExceptionFilter } from './ExceptionFilters/SystemExceptionFilter';



async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule,new FastifyAdapter(),{
  });
  // app.useLogger(app.get(AppLogger));
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new BusinessExceptionFilter(),new SystemExceptionFilter());
  await app.listen(7379,'0.0.0.0');
}
bootstrap();
