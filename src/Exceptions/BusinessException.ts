export class BusinessException extends Error {
    constructor(message?: string | object | any, public error?: string){
        super(
            message
          );
    }
}