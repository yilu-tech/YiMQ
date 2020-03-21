
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
                    data: null,
                    job: null
    
                }
                //统一格式化http request excepiton 记录到bull.job 的failedReason中
                if(error instanceof HttpCoordinatorRequestException){
                    message.data = error.data
                }
                if(job){
                    message.job = job.toJson();
                }
                Logger.error(message,null,'HttpCoordinator.process');
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
            Logger.debug(body,'CallActor')
            let result = await axios.post(this.actor.api,body,config);
            return result;            
        } catch (error) {
            let message = `${action}: <${this.actor.api}> ${error.message}`;
            let data = {
                api: this.actor.api,
                context: context,
                response: null
            }
            if(error.response){
                data.response = error.response.data
            }

            throw new HttpCoordinatorRequestException(message,data);

        }
    }
}