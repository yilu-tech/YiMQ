import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter } from '@nestjs/core/adapters/fastify-adapter';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './filters/HttpExceptionFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,new FastifyAdapter());
  // app.useGlobalFilters(new HttpExceptionFilter);
  app.useGlobalPipes(new ValidationPipe());
  await app.listen(7379,'0.0.0.0');
}
bootstrap();
