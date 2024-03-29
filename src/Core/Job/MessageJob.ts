import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import * as bull from 'bull';
import { SystemException } from "../../Exceptions/SystemException";
import { Exclude, Expose } from "class-transformer";
import { ExposeGroups } from "../../Constants/ToJsonConstants";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";

@Exclude()
export class MessageJob extends Job{
    @Expose()
    public message_id:number | string;
    @Expose({groups:[ExposeGroups.JOB_PARENT]})
    public message:TransactionMessage;//TransactionMessage ---> Message
    constructor(message:TransactionMessage,public readonly context:bull.Job){
        super(context)
        this.message_id = message.id;
        this.message = message;
    }
    async process() {
        let result:CoordinatorProcessResult = {process:null,actor_result:null};
        switch (this.message.status) {
            case MessageStatus.DOING:
                result = await this.message.toDoing();
                result.action = 'do';
                break;
            case MessageStatus.CANCELLING:
                result = await this.message.toCancelling()
                result.action = 'cancel';
                break;
            case MessageStatus.PENDING://超时后远程检查任务状态
                result = await this.remoteCheck();
                break;
            case MessageStatus.PREPARED://超时后远程检查任务状态
                result = await this.remoteCheck();
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
        result.subtask_total = this.message.subtask_total
        result.message_topic = this.message.topic
        return result;

    
    }

    private async remoteCheck():Promise<CoordinatorProcessResult>{

        let context = {
            message_id: this.message_id,
            actor_id: this.message.producer.id,
            job_id: this.message.job_id,
            job_key: `bull:${this.message.producer.id}:${this.message.job_id}`
        }
        let result:CoordinatorProcessResult = {process:null};
        try {
            var {callResult,callBody} = await this.message.producer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.MESSAGE_CHECK,context);   
        } catch (error) {
            //TODO 临时，应该直接throw
            if(this.message.producer.options.message_check_not_exist_ignore && error.response && error.response.message == 'Message not exists.'){
                callResult={status:ActorMessageStatus.CANCELED}
            }else{
                throw error;
            }
        }
        switch (callResult.status) {
            case ActorMessageStatus.CANCELED:
                result = await this.message.toCancelling();
                result.action = 'cancel';
                break;
            case ActorMessageStatus.DONE:
                result = await this.message.toDoing();
                result.action = 'do';
                break;
            case ActorMessageStatus.PENDING:
                throw new SystemException(`ActorMessageStatus is ${callResult.status}`);
            case ActorMessageStatus.PREPARED:
                throw new SystemException(`ActorMessageStatus is ${callResult.status}`);
            default:
                throw new SystemException(`ActorMessageStatus ${callResult.status} is not exists.`);
        }
        return {
            ...result,
            actor_result: callResult,
        };
    }
}