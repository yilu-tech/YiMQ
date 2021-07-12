import { Actor } from "./Actor";
import { Job } from "./Job/Job";
import { JobType } from "../Constants/JobConstants";

import { MessageJob } from "./Job/MessageJob";
import { SubtaskJob } from "./Job/SubtaskJob";
import { Message } from "./Messages/Message";
import * as bull from 'bull';
import { TransactionMessage } from "./Messages/TransactionMessage";
import { Subtask } from "./Subtask/BaseSubtask/Subtask";
import { ActorClearJob } from "./Job/ActorClearJob";
import { SystemException } from "../Exceptions/SystemException";
import { ConsumerSubtask } from "./Subtask/BaseSubtask/ConsumerSubtask";
import { Application } from "../Application";
import { BusinessException } from "../Exceptions/BusinessException";
import { JobModel } from "../Models/JobModel";
import { TestJob } from "./Job/TestJob";
export class JobManager{
    public application:Application;
    constructor(private actor:Actor){
        this.application = actor.actorManager.application;
    }

    public factory(from:Message|Subtask,type:JobType){
        switch(type){
            case JobType.MESSAGE:
                return new MessageJob(<TransactionMessage>from);
            case JobType.SUBTASK:
                return new SubtaskJob(<ConsumerSubtask>from);
            default:
                throw new BusinessException('JobType is not exists.');
        }
    }


    // public async get(id){
    //     let jobContext = await this.actor.coordinator.getJob(id);
    //     return this.restore(jobContext);
    // }
   
    public async restoreByContext(jobContext:bull.Job){
        let job:Job;
        let message;
        switch (jobContext.data.type) {
            case JobType.MESSAGE:
                message = await this.actor.messageManager.get(jobContext.data.message_id);
                job = new MessageJob(message);
                break;
            case JobType.SUBTASK:
                //由于subtask的job不一定和它的subjob在同一个actor，也就不一定在同一个redis，所以直接通过id无法查找
                //拿到job的producer
                let producer = this.actor.actorManager.getById(jobContext.data.producer_id);
                if(!producer){
                    throw new SystemException(`Job ${jobContext.id} of Actor ${this.actor.id} not found ${jobContext.data.producer_id} producer.`)
                }
                let subtask = <ConsumerSubtask>await producer.subtaskManager.get(jobContext.data.subtask_id);
                if(!subtask){
                    throw new SystemException(`Actor [${this.actor.name}-${this.actor.id}] Job ${jobContext.id} not found producer [${jobContext.data.producer_id}] Subtask ${jobContext.data.subtask_id}.`)
                }
                
                //生成subtask实例
                job = new SubtaskJob(subtask);
                subtask.job = <SubtaskJob>job;
                break;
            case JobType.ACTOR_CLEAR:
                job = new ActorClearJob(this.actor);
                break;
            default:
                throw new Error('JobType is not exists.');
        }
        // await job.restore();      
        return job;
    }
    
    public async restoreByModel(jobModel:JobModel){
        let job:Job;
        switch(jobModel.type){
            case JobType.MESSAGE:
                let message = <TransactionMessage>await this.actor.messageManager.get(jobModel.relation_id);
                job = new MessageJob(message);
                await job.restore(jobModel);
                break;
            case JobType.SUBTASK:
                break;
            case JobType.TEST:
                job = new TestJob(this.actor);
                await job.restore(jobModel)
                break;
            default:
                throw new BusinessException('JOBTYPE_IS_NOT_EXISTS');
        }
        return job;
    }

    public async get(id){
        if(id == null){
            return null;
        }
        let jobContext = await this.actor.coordinator.getJob(id);
        if(!jobContext){
            return null;
        }
        return this.restoreByContext(jobContext);
    }

    public async getJobModel(id){
        return await this.application.database.JobModel.where({_id:id}).findOne();
    }
}