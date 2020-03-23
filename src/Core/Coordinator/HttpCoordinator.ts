
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
import {Logger } from '@nestjs/common';
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
                let debugMsg = `Process job: message-${jobContext.data.message_id} ${jobContext.data.type}`;
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

                Logger.error({
                    message: message.message,
                    job: message.job,
                    actor_response_message: message.actor_response['message'],
                    tips: 'Details View UI Manager.'
                },error.stack,'HttpCoordinator.process');
            
                throw new Error(JSON.stringify(message));
            }
        })
    };

    public async callActor(producer:Actor,action:CoordinatorCallActorAction,context) {
        try {
            let config = {
                headers:{
                    'content-type':'application/json'
                }
            }
            let body = {
                action: action,
                context: context
            };
            let result = (await axios.post(this.actor.api,body,config)).data;
            body['result'] = result;
            Logger.debug(body,'CallActor')
            return result;            
        } catch (error) {
            throw new HttpCoordinatorRequestException(this,action,context,error);
        }
    }
}