import { Job } from "./Job";
import axios from 'axios';
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
export class TransactionMessageJob extends Job{
    async process() {
        switch (this.message.status) {
            case MessageStatus.DOING:
                await this.toDo();
                break;
            case MessageStatus.CANCELLING:
                await this.toCancel()
                break;
            case MessageStatus.PENDING:
                await this.remoteCheck();
                break;
            default:
                throw new Error('MessageStatus is not exists.');
        }

    
    }

    private async remoteCheck(){
        let result = await axios.post(this.message.producer.api,{
            action: this.action,
            message_id: this.message_id
        });
        switch (result.data.status) {
            case ActorMessageStatus.CANCELED:
                await this.message.statusToCancelling();
                await this.toCancel();
                break;
            case ActorMessageStatus.DONE:
                await this.message.statusToDoing();
                await this.toDo();
                break;
            case ActorMessageStatus.PENDING:
                throw new Error('ActorMessageStatus is PENDING');
            default:
                throw new Error('ActorMessageStatus is not exists.');
        }
    }

    private async toDo(){
        //TODO  创建子任务

    }
    private async toCancel(){
        //TODO 创建子任务

    }


}