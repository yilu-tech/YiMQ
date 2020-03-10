
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
import {Logger } from '@nestjs/common';
import axios from 'axios';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { Actor } from '../Actor';

export class HttpCoordinator extends Coordinator{
    
    public processBootstrap(){
        this.queue.process('*',1000,async (jobContext:bull.Job)=>{
            try {
                let debugMsg = `Process job: message-${jobContext.data.message_id} ${jobContext.data.type}`;
                debugMsg += jobContext.data.subtask_id? ` subtask-${jobContext.data.subtask_id||''}` : '';
                Logger.debug(debugMsg,'HttpCoordinator')
                let job = await this.actor.jobManager.restoreByContext(jobContext);
                return job.process();
            } catch (err) {
                // Logger.error(err.message,'HttpCoordinator');
                throw err;
            }
        })
    };

    public async callActor(producer:Actor,action:CoordinatorCallActorAction,context) {
        Logger.debug(`${action}: ${producer.name} --> ${context.processer||''}`,'HttpCoordinator')
        try {
            let result = await axios.post(this.actor.api,{
                action: action,
                context: context
            });
            return result;            
        } catch (error) {
            if(error.response){
                let message = {
                    message: error.message,
                    statusCode: error.response.status,
                    data: error.response.data
                }
                throw new Error(JSON.stringify(message))
            }
            throw error;

        }
    }
}