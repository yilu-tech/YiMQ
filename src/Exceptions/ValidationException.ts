import { HttpException, HttpStatus, UnprocessableEntityException } from "@nestjs/common";

export class ValidationException extends HttpException {
    constructor(error){
        let message = {
            statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'validation_error',
            data:{}
            
        }

        for (const item of error) {
            let validationErrors = [];
            for (const key in item.constraints) {
                validationErrors.push(item.constraints[key]);
            }
            message.data[item['property']] = validationErrors
        }
        super(message,HttpStatus.UNPROCESSABLE_ENTITY);
    }
}