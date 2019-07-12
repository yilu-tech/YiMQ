import { ExceptionFilter, Catch, ArgumentsHost, HttpStatus } from '@nestjs/common';
import { TransactionException } from '../Exceptions/TransactionException';

@Catch(TransactionException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: TransactionException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    response
      .code(HttpStatus.BAD_REQUEST)
      .send({
        message: exception.message
      });
  }
}