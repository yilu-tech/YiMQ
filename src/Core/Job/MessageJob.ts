import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import * as bull from 'bull';
import { SystemException } from "../../Exceptions/SystemException";
import { Exclude, Expose } from "class-transformer";
import { ExposeGroups } from "../../Constants/ToJsonConstants";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { Message } from "../Messages/Message";
import { JobStatus, JobType } from "../../Constants/JobConstants";
import { JobCreateTransactionCallback, TransactionCallback } from "../../Handlers";
import { JobOptions } from "../../Interfaces/JobOptions";
import { ClientSession } from "mongoose";

@Exclude()
export class MessageJob extends Job{
    @Expose()
    // public message_id:any;
    @Expose({groups:[ExposeGroups.JOB_PARENT]})
    public message:TransactionMessage;//TransactionMessage ---> Message
    public check_timeout = 1000*10;
    
    type = JobType.MESSAGE
    constructor(message:TransactionMessage){
        super(message.producer)
        this.relation_id = message.id;
        this.message = message;
    }

    public async create(jobOptions:JobOptions,session:ClientSession){
        this.model.status = JobStatus.DELAYED;
        await super.create(jobOptions,session);
        return this;
    }
    async process() {
        let result:CoordinatorProcessResult;

        // await this.message.lock('process',this.check_timeout * 1.5)
        await this.message.refresh();

        try{
            switch (this.message.status) {
                case MessageStatus.DOING:
                    result = await this.message.toDoing();
                    result.action = 'toDoing';
                    break;
                case MessageStatus.CANCELLING:
                    result = await this.message.toCancelling()
                    result.action = 'toCancelling';
                    break;
                case MessageStatus.PENDING://超时后远程检查任务状态
                    result = await this.remoteCheck();
                    result.action = 'remoteCheck';
                    break;
                case MessageStatus.PREPARED://超时后远程检查任务状态
                    result = await this.remoteCheck();
                    result.action = 'remoteCheck';
                    break;
                case MessageStatus.DONE:
                    throw new SystemException('MessageStatus is DONE.');
                    // result = {process:'compensate done'}
                    // break;
                case MessageStatus.CANCELED:
                    throw new SystemException('MessageStatus is CANCELED.');
                    // result = {process:'compensate canceled'}
                    // break;
                default:
                    throw new SystemException(`MessageStatus <${this.message.status}> is not exists.`);
            }
            return result;
        }finally{
            await this.message.healthCheck();
            // await this.message.unlock();
        }

    
    }

    private async remoteCheck():Promise<CoordinatorProcessResult>{

        let context = {
            message_id: this.relation_id,
            actor_id: this.message.producer.id,
            job_id: this.message.job_id,
            job_key: `bull:${this.message.producer.id}:${this.message.job_id}`,
            attempts_made: this.attempts_made
        }
        let result:CoordinatorProcessResult;
        let options = {
            timeout: this.check_timeout
        }
        let actor_result = await this.message.producer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.MESSAGE_CHECK,context,options);
        switch (actor_result.status) {
            case ActorMessageStatus.CANCELED:
                // await this.message.setStatus(MessageStatus.CANCELLING).save();
                result = await this.message.toCancelling()
                break;
            case ActorMessageStatus.DONE:
                // await this.message.setStatus(MessageStatus.DOING).save();
                result = await this.message.toDoing()
                break;
            case ActorMessageStatus.PENDING:
                throw new SystemException(`ActorMessageStatus is ${actor_result.status}`);
            case ActorMessageStatus.PREPARED:
                throw new SystemException(`ActorMessageStatus is ${actor_result.status}`);
            default:
                throw new SystemException(`ActorMessageStatus ${actor_result.status} is not exists.`);
        }
        return {
            ...result,
            actor_result: actor_result
        };
    }
}