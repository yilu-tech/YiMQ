export class HttpCoordinatorRequestException extends Error {
    constructor(message?: string, public data?: string | object | any){
        super(
            message
          );
    }
}