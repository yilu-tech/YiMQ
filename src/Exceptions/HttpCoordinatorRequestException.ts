import {AxiosError} from 'axios';
import { Coordinator } from '../Core/Coordinator/Coordinator';


export  class CoordinatorRequestException extends Error{
    public response:{
        message:null,
        data:null,
        stack:null
    };

    public getRespone(){
        return this.response;
    }
}

export class HttpCoordinatorRequestException extends CoordinatorRequestException {
    public response:any;
    public statusCode:number;
    constructor(coordinator:Coordinator,action,context,error:AxiosError){
        let message = `${action}: ${coordinator.actor.api} ${error.message}`;
        super(
            message
          );

        this.statusCode = error.response.status;
        if(error.response && error.response.data){
            // this.response.meesage = error.response.data.message;
            // this.response.data = error.response.data.data;
            // this.response.stack = error.response.data.stack;
            this.response = error.response.data;
        }
    }


}