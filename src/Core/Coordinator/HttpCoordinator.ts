
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
import { Logger} from '../../Handlers/Logger';
import axios from 'axios';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { Actor } from '../Actor';
import { HttpCoordinatorRequestException } from '../../Exceptions/HttpCoordinatorRequestException';
import { Job } from '../Job/Job';
export class HttpCoordinator extends Coordinator{
    
    public processBootstrap(){
        this.queue.process('*',1000,async (jobContext:bull.Job)=>{
            let job:Job = null;
            try {
                let debugMsg = `Process job: ${jobContext.data.type}`;
                debugMsg += jobContext.data.message_id? ` message-${jobContext.data.message_id}`:'';
                debugMsg += jobContext.data.subtask_id? ` subtask-${jobContext.data.subtask_id||''}` : '';
                Logger.debug(debugMsg,'HttpCoordinator')
                job = await this.actor.jobManager.restoreByContext(jobContext);
                return await job.process();
            } catch (error) {
                       
                let message = {
                    message: error.message,
                    job: {},
                    actor_response: {}
                }
                if(job){
                    message.job = job.toJson();
                }
                

                //统一格式化http request excepiton 记录到bull.job 的failedReason中
                if(error instanceof HttpCoordinatorRequestException){
                    message.actor_response = error.getRespone();
                }
                let ext = {
                    job: message.job,
                    actor_response_message: message.actor_response['message'],
                    tips: 'Error details View UI Manager.'
                }
                Logger.error(Logger.message(message.message,ext),undefined,`HttpCoordinator.${this.actor.name}.process`)
                throw new Error(JSON.stringify(message));
            }
        })
    };

    public async callActor(producer:Actor,action:CoordinatorCallActorAction,context={}) {
        let config = {
            headers:{
                'content-type':'application/json',
                ...this.actor.options.headers
            }
        }
        let body = {
            action: action,
            api: this.actor.api,
            request_config: config,
            context: context
        };

        try {
            let result = (await axios.post(this.actor.api,body,config)).data;
            Logger.debug(Logger.message('call actor',{request:body,response:result}),'HttpCoordinator')
            return result;            
        } catch (error) {
            Logger.debug(Logger.message('call actor',{request:body}),'HttpCoordinator',{request:body})
            throw new HttpCoordinatorRequestException(this,action,context,error);
        }
    }
}