import { Job } from "./Job";
import axios from 'axios';
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
    import { from } from "rxjs";
import { Subtask } from "../Subtask/Subtask";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { JobType } from "../../Constants/JobConstants";
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
export class TransactionMessageJob extends Job{
    public message:TransactionMessage;
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

        let context = {
            message_id: this.message_id
        }
        let result = await this.message.producer.coordinator.callActor(CoordinatorCallActorAction.MESSAGE_CHECK,context);
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
        for (const [id,subtask] of this.message.subtasks) {
            let jobOptions = {
                jobId: Number(subtask.id)
            }
            //添加subtask的job
            subtask.status = SubtaskStatus.DOING;
            await subtask.update();
            let job = await subtask.actor.jobManager.add(this.message,JobType.TRANSACTION_SUBTASK,jobOptions);
        }

    }
    private async toCancel(){
        //TODO 创建子任务

    }


}