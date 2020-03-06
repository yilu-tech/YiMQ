import { Actor } from "./Actor";
import { Job } from "./Job/Job";
import { JobType } from "../Constants/JobConstants";
import { GeneralJob } from "./Job/GeneralJob";
import { TransactionMessageJob } from "./Job/TransactionMessageJob";
import { TransactionSubtaskJob } from "./Job/TransactionSubtaskJob";
import { Message } from "./Messages/Message";
import * as bull from 'bull';
export class JobManager{
    constructor(private actor:Actor){
    }

    public async add(message:Message,type:JobType,jobOptions:bull.JobOptions={}){
        let data = {
            message_id: message.id,
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
        jobOptions = Object.assign(defaultOptions,jobOptions);
        let jobContext = await this.actor.coordinator.add(message.topic,data,jobOptions);
        return this.factory(message,type,jobContext);
    }
    public async get(id){
        let jobContext = await this.actor.coordinator.getJob(id);
        return this.restore(jobContext);
    }
    public async restore(jobContext:bull.Job){
        let message = await this.actor.messageManager.get(jobContext.data.message_id);
        return this.factory(message,jobContext.data.type,jobContext);
    }

    public async restoreByMessage(message:Message){
        let jobContext = await this.actor.coordinator.getJob(message.job_id);
        return this.factory(message,jobContext.data.type,jobContext);
    }

    
    public factory(message,type,jobContext:bull.Job){
        let job:Job;
        switch (type) {
            case JobType.GENERAL:
                job = new GeneralJob(message,jobContext);
                break;
            case JobType.TRANSACTION:
                job = new TransactionMessageJob(message,jobContext);
                break;
            case JobType.TRANSACTION_SUBTASK:
                job = new TransactionSubtaskJob(message,jobContext);
                break;
            default:
                throw new Error('JobType is not exists.');
        }      
        return job;
    }
}