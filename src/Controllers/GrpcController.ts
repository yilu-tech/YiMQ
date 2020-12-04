import { Controller } from "@nestjs/common";
import {GrpcMethod, GrpcStreamMethod, GrpcStreamCall} from '@nestjs/microservices';
let id = 0;
@Controller()
export class GrpcController {

    @GrpcMethod('MessageService')
    create(req): any {

      console.log(req);
      return {data: JSON.stringify( {id:id++})};
    }

}