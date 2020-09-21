import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { CoordinatorRequestException } from '../Exceptions/HttpCoordinatorRequestException';
import { Logger} from '../Handlers/Logger';


@Catch(CoordinatorRequestException)
export class CoordinatorRequestExceptionFilter implements ExceptionFilter {
  catch(exception: CoordinatorRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    let message = `${exception.message}`;
    if(exception.response){
      message = `${message} -> response message: ${exception.response.message}`
    }
    Logger.error(message,exception.stack,'CoordinatorRequestException')
    response
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({
        message: message,
        data: exception.getRespone()
      });
  }
}