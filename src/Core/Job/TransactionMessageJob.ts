import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import * as bull from 'bull';
export class TransactionMessageJob extends Job{
    public message_id:number | string;
    public message:TransactionMessage;
    constructor(message:TransactionMessage,public readonly context:bull.Job){
        super(context)
        this.message_id = message.id;
        this.message = message;
    }
    async process() {
        let result = 'success';
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
            default:
                throw new Error('MessageStatus is not exists.');
        }
        return result;

    
    }

    private async remoteCheck(){

        let context = {
            message_id: this.message_id
        }
        let result = await this.message.producer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.MESSAGE_CHECK,context);
        switch (result.data.status) {
            case ActorMessageStatus.CANCELED:
                await this.message.toCancelling();
                break;
            case ActorMessageStatus.DONE:
                await this.message.toDoing();
                break;
            case ActorMessageStatus.PENDING:
                throw new Error('ActorMessageStatus is PENDING');
            default:
                throw new Error('ActorMessageStatus is not exists.');
        }
        return result;
    }

}