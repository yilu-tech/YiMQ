import {AxiosError} from 'axios';
import { Coordinator } from '../Core/Coordinator/Coordinator';
//TODO Add filter for this exception
export class HttpCoordinatorRequestException extends Error {
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

    public getRespone(){
        return this.response;
    }
}