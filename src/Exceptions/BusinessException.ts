export class BusinessException extends Error {
    constructor(code:string,message?: string | object | any, public error?: string){
        super(
            code
          );
    }
}