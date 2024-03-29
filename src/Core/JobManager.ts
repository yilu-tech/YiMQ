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
import { merge } from "lodash";
export class JobManager{
    constructor(private actor:Actor){
    }


    // public async get(id){
    //     let jobContext = await this.actor.coordinator.getJob(id);
    //     return this.restore(jobContext);
    // }
    public async add(from:Message|Subtask,type:JobType,jobOptions:bull.JobOptions={}){
        let job:Job;
        let message:any;
        let jobContext;
        let data;
        let defaultOptions:bull.JobOptions = {
            attempts: this.actor.options.job_attempts_total,
            backoff:{
                type:'exponential',
                delay: this.actor.options.job_attempts_delay  // delay*1  delay*3 delay*7 delay*15     delay*(times*2+1) times开始于0
            }
        };
        jobOptions = merge(defaultOptions,jobOptions);
        switch (type) {
            case JobType.MESSAGE:
                message = <TransactionMessage>from;
                data = {
                    message_id: message.id,
                    type: type,
                };

                jobOptions.delay = jobOptions.delay >= this.actor.options.message_check_min_delay ? jobOptions.delay : this.actor.options.message_check_min_delay;
                jobContext = await this.actor.coordinator.add(message.topic,data,jobOptions);
                job = new MessageJob(message,jobContext);
                break;
            case JobType.SUBTASK:
                let subtask = <Subtask>from;
                data = {
                    producer_id: subtask.message.producer.id,
                    message_id: subtask.message.id,
                    subtask_id: subtask.id,
                    type: JobType.SUBTASK,
                }
                jobOptions.delay = Number(process.env.SUBTASK_JOB_DELAY) || 0;//单元测试部分地方需要延时
                jobOptions.attempts = subtask.options.attempts || jobOptions.attempts;


                jobContext = await this.actor.coordinator.add(subtask.message.topic,data,jobOptions);
                job = new SubtaskJob(subtask,jobContext);
                break;
            default:
                throw new Error('JobType is not exists.');
        }      
        return job;

    }
    public async restoreByContext(jobContext:bull.Job){
        let job:Job;
        let message;
        switch (jobContext.data.type) {
            case JobType.MESSAGE:
                message = await this.actor.messageManager.get(jobContext.data.message_id);
                job = new MessageJob(message,jobContext);
                break;
            case JobType.SUBTASK:
                //由于subtask的job不一定和它的subjob在同一个actor，也就不一定在同一个redis，所以直接通过id无法查找
                //拿到job的producer
                let producer = this.actor.actorManager.getById(jobContext.data.producer_id);
                if(!producer){
                    throw new SystemException(`Job ${jobContext.id} of Actor ${this.actor.id} not found ${jobContext.data.producer_id} producer.`)
                }
                let subtask = await producer.subtaskManager.get(jobContext.data.subtask_id);
                if(!subtask){
                    throw new SystemException(`Actor [${this.actor.name}-${this.actor.id}] Job ${jobContext.id} not found producer [${jobContext.data.producer_id}] Subtask ${jobContext.data.subtask_id}.`)
                }
                
                //生成subtask实例
                job = new SubtaskJob(subtask,jobContext);
                break;
            case JobType.ACTOR_CLEAR:
                job = new ActorClearJob(this.actor,jobContext);
                break;
            default:
                throw new Error('JobType is not exists.');
        }
        await job.restore();      
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
}