import { HttpException ,BadRequestException, HttpStatus} from "@nestjs/common";
import {createHttpExceptionBody} from '@nestjs/common/utils/http-exception-body.util'

export class BusinessException extends Error {
    constructor(message?: string | object | any, error?: string){
        super(
            message
          );
    }
}