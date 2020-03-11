export class BusinessException extends Error {
    constructor(message?: string | object | any, error?: string){
        super(
            message
          );
    }
}