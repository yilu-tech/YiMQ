import { HttpException ,BadRequestException, HttpStatus} from "@nestjs/common";
import {createHttpExceptionBody} from '@nestjs/common/utils/http-exception-body.util'

export class BusinessException extends HttpException {
    constructor(message?: string | object | any, error?: string){
        super(
            createHttpExceptionBody(message, error, HttpStatus.BAD_REQUEST),
            HttpStatus.BAD_REQUEST,
          );
    }
}