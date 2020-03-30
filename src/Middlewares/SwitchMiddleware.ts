import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { Application } from '../Application';

@Injectable()
export class SwitchMiddleware implements NestMiddleware {
  constructor(private app:Application){

  }
  use(req, res, next: Function) {
    if(this.app.isOnline()){
      return next();
    }

    res.statusCode = HttpStatus.SERVICE_UNAVAILABLE;
    res.end('Service Unavailable.');
 
  }
}