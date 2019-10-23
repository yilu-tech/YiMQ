import { Actor } from "./Actor";
import { Job } from "./Job/Job";
import { JobType, JobAction } from "../Constants/JobConstants";
import { GeneralJob } from "./Job/GeneralJob";
import { TransactionJob } from "./Job/TransactionJob";
import { TransactionItemJob } from "./Job/TransactionItemJob";
import { BusinessException } from "../Exceptions/BusinessException";
import { Message } from "./Messages/Message";
import * as bull from 'bull';
export class JobManager{
    constructor(private actor:Actor){
    }

    public async add(message:Message,type:JobType,action:JobAction,options:bull.JobOptions={}){
        let data = {
            message_id: message.id,
            action: action,
            type: type,
        }
        let defaultOptions:bull.JobOptions = {
            delay:2000,
            attempts:5,
            backoff:{
                type:'exponential',
                delay: 5000  // delay*1  delay*3 delay*7 delay*15     delay*(times*2+1) times开始于0
            }
        };
        options = Object.assign(defaultOptions,options);
        let jobContext = await this.actor.coordinator.add(message.topic,data,options);
        return this.factory(message,type,jobContext);
    }
    public async restore(jobContext:bull.Job){
        let message = await this.actor.messageManager.get(jobContext.data.message_id);
        return this.factory(message,jobContext.data.type,jobContext);
    }
    public factory(message,type,jobContext:bull.Job){
        let job:Job;
        switch (type) {
            case JobType.GENERAL:
                job = new GeneralJob(message,jobContext);
                break;
            case JobType.TRANSACTION:
                job = new TransactionJob(message,jobContext);
                break;
            case JobType.TRANSACTION_ITEM:
                job = new TransactionItemJob(message,jobContext);
                break;
            default:
                throw new Error('JobType is not exists.');
        }      
        return job;
    }
}