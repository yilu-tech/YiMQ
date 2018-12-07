import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { FastifyAdapter } from '@nestjs/core/adapters/fastify-adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule,new FastifyAdapter());
  await app.listen(3000);
}
bootstrap();
