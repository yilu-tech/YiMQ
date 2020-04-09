import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { join } from 'path';
import { Transport } from '@nestjs/microservices/enums/transport.enum';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'HERO_PACKAGE',
        transport: Transport.GRPC,
        options: {
            package: 'hero',
            protoPath: join(process.cwd(), 'protos/hero.proto'),
        },
      },
    ]),
  ],
  controllers: [],
})
export class ClientModule {}