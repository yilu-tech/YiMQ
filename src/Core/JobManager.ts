import { Actor } from "./Actor";
import { Job } from "./Job/Job";
import { JobType } from "../Constants/JobConstants";
import { GeneralJob } from "./Job/GeneralJob";
import { TransactionMessageJob } from "./Job/TransactionMessageJob";
import { TransactionSubtaskJob } from "./Job/TransactionSubtaskJob";
import { Message } from "./Messages/Message";
import * as bull from 'bull';
import { TransactionMessage } from "./Messages/TransactionMessage";
import { Subtask } from "./Subtask/Subtask";
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
            jobId: await this.actor.actorManager.getJobGlobalId(),
            attempts:5,
            backoff:{
                type:'exponential',
                delay: 5000  // delay*1  delay*3 delay*7 delay*15     delay*(times*2+1) times开始于0
            }
        };
        jobOptions = Object.assign(defaultOptions,jobOptions);
        switch (type) {
            case JobType.GENERAL:              
                message = <Message>from;
                data = {
                    message_id: message.id,
                    type: type,
                };
                jobContext = await this.actor.coordinator.add(message.topic,data,jobOptions);
                job = new GeneralJob(jobContext);
                break;
            case JobType.TRANSACTION:
                message = <TransactionMessage>from;
                data = {
                    message_id: message.id,
                    type: type,
                };
                jobOptions.delay = jobOptions.delay ? jobOptions.delay : Number(process.env.TRANSACATION_MESSAGE_JOB_DELAY);
                jobContext = await this.actor.coordinator.add(message.topic,data,jobOptions);
                job = new TransactionMessageJob(message,jobContext);
                break;
            case JobType.TRANSACTION_SUBTASK:
                let subtask = <Subtask>from;
                data = {
                    producer_id: subtask.message.producer.id,
                    message_id: subtask.message.id,
                    subtask_id: subtask.id,
                    type: JobType.TRANSACTION_SUBTASK,
                }
                jobOptions.delay = Number(process.env.SUBTASK_JOB_DELAY) || 0;//单元测试部分地方需要延时
                jobOptions.backoff = {
                    type:'exponential',
                    delay: Number(process.env.SUBTASK_JOB_BACKOFF_DELAY) || 5000 // delay*1  delay*3 delay*7 delay*15     delay*(times*2+1) times开始于0
                }
                jobContext = await this.actor.coordinator.add(subtask.message.topic,data,jobOptions);
                job = new TransactionSubtaskJob(subtask,jobContext);
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
            case JobType.GENERAL:
                job = new GeneralJob(jobContext);
                break;
            case JobType.TRANSACTION:
                message = await this.actor.messageManager.get(jobContext.data.message_id);
                job = new TransactionMessageJob(message,jobContext);
                break;
            case JobType.TRANSACTION_SUBTASK:
                //由于subtask的job不一定和它的subjob在同一个actor，也就不一定在同一个redis，所以直接通过id无法查找
                //拿到job的producer
                let producer = this.actor.actorManager.getById(jobContext.data.producer_id);
                //通过producer获取到subtask的message
                message = await producer.messageManager.get(jobContext.data.message_id);
                //通过message拿到subtask
                let subtask = (<TransactionMessage>message).getSubtask(jobContext.data.subtask_id);
                //生成subtask实例
                job = new TransactionSubtaskJob(subtask,jobContext);
                break;
            default:
                throw new Error('JobType is not exists.');
        }      
        return job;
    }
}