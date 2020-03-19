import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';

import { SystemException } from '../Exceptions/SystemException';

@Catch(SystemException)
export class SystemExceptionFilter implements ExceptionFilter {
  catch(exception: SystemException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    Logger.error(`${exception.message} > ${exception.error} `)
    response
      .code(HttpStatus.INTERNAL_SERVER_ERROR)
      .send({
        message: exception.message,
        error: exception.error
      });
  }
}