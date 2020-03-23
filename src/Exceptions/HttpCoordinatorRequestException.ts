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
    constructor(coordinator:Coordinator,action,context,error:AxiosError){
        let message = `${action}: ${coordinator.actor.api} ${error.message}`;
        super(
            message
          );

        
        this.response = {
            api: coordinator.actor.api,
            context: context,
        }
        if(error.response && error.response.data){
            // this.response.meesage = error.response.data.message;
            // this.response.data = error.response.data.data;
            // this.response.stack = error.response.data.stack;
            this.response = error.response.data;
        }
    }


}