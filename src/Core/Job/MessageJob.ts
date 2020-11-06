import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import * as bull from 'bull';
import { SystemException } from "../../Exceptions/SystemException";
import { Expose } from "class-transformer";
export class MessageJob extends Job{
    @Expose()
    public message_id:number | string;
    @Expose({groups:['full']})
    public message:TransactionMessage;//TransactionMessage ---> Message
    constructor(message:TransactionMessage,public readonly context:bull.Job){
        super(context)
        this.message_id = message.id;
        this.message = message;
    }
    async process() {
        let result = {};
        switch (this.message.status) {
            case MessageStatus.DOING:
                await this.message.toDoing();
                break;
            case MessageStatus.CANCELLING:
                await this.message.toCancelling()
                break;
            case MessageStatus.PENDING://超时后远程检查任务状态
                result = await this.remoteCheck();
                break;
            case MessageStatus.DONE:
                throw new SystemException('MessageStatus is CANCELED.');
            case MessageStatus.CANCELED:
                throw new SystemException('MessageStatus is CANCELED.');
            default:
                throw new SystemException(`MessageStatus <${this.message.status}> is not exists.`);
        }
        return result;

    
    }

    private async remoteCheck(){

        let context = {
            message_id: this.message_id,
            actor_id: this.message.producer.id,
            job_id: this.message.job_id,
            job_key: `bull:${this.message.producer.id}:${this.message.job_id}`
        }
        let result = await this.message.producer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.MESSAGE_CHECK,context);
        switch (result.status) {
            case ActorMessageStatus.CANCELED:
                await this.message.toCancelling();
                break;
            case ActorMessageStatus.DONE:
                await this.message.toDoing();
                break;
            case ActorMessageStatus.PENDING:
                throw new SystemException('ActorMessageStatus is PENDING');
            default:
                throw new SystemException(`ActorMessageStatus ${result.status} is not exists.`);
        }
        return result;
    }

}