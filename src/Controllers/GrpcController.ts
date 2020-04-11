import { Controller } from "@nestjs/common";
import {GrpcMethod, GrpcStreamMethod, GrpcStreamCall} from '@nestjs/microservices';
let id = 0;
@Controller()
export class GrpcController {

    @GrpcMethod('ServerService')
    createMessage(req): any {
      req.data = JSON.parse(req.data);
      console.log(req);
      return {data: JSON.stringify( {id:id++})};
    }

}