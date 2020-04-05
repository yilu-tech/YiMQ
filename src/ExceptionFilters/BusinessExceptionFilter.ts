import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';

import { BusinessException } from '../Exceptions/BusinessException';
import { Logger} from '../Handlers/Logger';
@Catch(BusinessException)
export class BusinessExceptionFilter implements ExceptionFilter {
  catch(exception: BusinessException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    Logger.debug(`${exception.message} `,'BusinessException')
    response
      .code(HttpStatus.BAD_REQUEST)
      .send({
        message: exception.message,
        error: exception.error
      });
  }
}