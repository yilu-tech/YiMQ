
import { Coordinator, CoordinatorProcessResult } from './Coordinator';
import * as bull from 'bull';
import axios from 'axios';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { Actor } from '../Actor';
import { HttpCoordinatorRequestException } from '../../Exceptions/HttpCoordinatorRequestException';
import { Job } from '../Job/Job';
import {AppLogger} from '../../Handlers/AppLogger';
import { OnDemandFastToJson } from '../../Decorators/OnDemand';
import { format } from 'date-fns';

export class HttpCoordinator extends Coordinator{
    
    public async processBootstrap(){
        this.queue.process('*',1000,async (jobContext:bull.Job)=>{
            let job:Job = null;
            let start_time = Date.now();
            try {
                // let debugMsg = `Process job: ${jobContext.data.type}`;
                // debugMsg += jobContext.data.message_id? ` message-${jobContext.data.message_id}`:'';
                // debugMsg += jobContext.data.subtask_id? ` subtask-${jobContext.data.subtask_id||''}` : '';
                // Logger.debug(debugMsg,'HttpCoordinator')
                job = await this.actor.jobManager.restoreByContext(jobContext);
                let result:CoordinatorProcessResult =  await job.process();
                await this.logProcessSuccess(start_time,job,result);
                return result;
            } catch (error) {
              
                this.logProcessFailure(start_time,error,jobContext.id,job)

                throw new Error(this.processExceptionContent(error));
            }
        })
        AppLogger.log(`Coordinator <${this.actor.name}> bootstrap`,`HttpCoordinator`)
    };

    private logProcessSuccess(start_time,job:Job,result:any){
        let end_time = Date.now()

        let content = {
            start_time: format(start_time,'yyyy-MM-dd HH:mm:ss'),
            type: 'process',
            job: OnDemandFastToJson(job),
            result,
            end_time: format(end_time,'yyyy-MM-dd HH:mm:ss'),
            cost_time: end_time - start_time
        }
        this.actor.actorManager.application.contextLogger.info(content);
    }
    private logProcessFailure(start_time,error:Error,job_id,job:Job){
        let end_time = Date.now()

        let content = {
            start_time: format(start_time,'yyyy-MM-dd HH:mm:ss'),
            type: 'process',
            message: error.message,
            job_id: job_id,
        }
        if(job){
            content['job'] = OnDemandFastToJson(job)
        }

        if(error instanceof HttpCoordinatorRequestException){
            content['actor_response'] = error.getRespone();
        }
        else{
            content['stack'] = error.stack;
        }

        content['end_time'] = format(end_time,'yyyy-MM-dd HH:mm:ss')
        content['cost_time'] = end_time - start_time;
        this.actor.actorManager.application.contextLogger.error(content);
    }

    private processExceptionContent(error:Error){
        
        let excepitonContent:any = {
            message: error.message
        }
        //如果有actor有响应，把响应内容存到failedReason中
        if(error instanceof HttpCoordinatorRequestException){
            excepitonContent.actor_response = error.getRespone();
        }
        return JSON.stringify(excepitonContent);
    }
    public async callActor(producer:Actor,action:CoordinatorCallActorAction,context:any={},options:any={}) {
        let config = {
            headers:{
                'content-type':'application/json',
                ...this.actor.options.headers
            },
            timeout: options.timeout ? options.timeout : 1000*10
        }
        let body = {
            action: action,
            api: this.actor.api,
            request_config: config,
            context: context
        };

        try {
            let response = await axios.post(this.actor.api,body,config);
            let result = response.data;
            // Logger.debug(Logger.message('call actor',{request:body,response:result}),'HttpCoordinator')
            return result;            
        } catch (error) {
            // Logger.debug(Logger.message('call actor',{request:body}),'HttpCoordinator',{request:body})
            throw new HttpCoordinatorRequestException(this,action,context,error);
        }
    }
}