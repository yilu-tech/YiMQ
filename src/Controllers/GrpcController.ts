import { Controller } from "@nestjs/common";
import {GrpcMethod, GrpcStreamMethod, GrpcStreamCall} from '@nestjs/microservices';

@Controller()
export class GrpcController {

    @GrpcMethod('MessageService')
    create(data): any {
      data.id = Date.now()
      console.log(data)
      return data;
    }

}