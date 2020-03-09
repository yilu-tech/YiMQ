import { Job } from "./Job";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { Subtask } from "../Subtask/Subtask";
import { Message } from "../Messages/Message";
import * as bull from 'bull';
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { CoordinatorCallActorAction } from "../../Constants/Coordinator";
export class TransactionSubtaskJob extends Job{
    public subtask_id:Number;
    public subtask:Subtask;
    constructor(subtask:Subtask,public readonly context:bull.Job){
        super(context);
        this.subtask = subtask;
        this.subtask_id = subtask.id;
    }
    async process() {
        console.log('TransactionSubtaskJob process--->',this.subtask.job_id,this.subtask.status)
        switch (this.subtask.status) {
            //重复做到成功为止
            case SubtaskStatus.DOING:
                let result = await this.toDo();
                await this.subtask.statusToDone();
                return result;
            case SubtaskStatus.CANCELLING:

                break;
            case SubtaskStatus.PREPARING:
                throw new Error('SubtaskStatus is PENDING');
            case SubtaskStatus.DONE:
                throw new Error('SubtaskStatus is DONE');
                break;
            default:
                throw new Error('SubtaskStatus is not exists.');
        }
    }

    async toDo(){
        let callContext = {
            message_id: this.subtask.message.id,
            subtask_id: this.subtask.id
        }
        let result = await this.subtask.consumer.coordinator.callActor(this.subtask.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);
        return result.data;
    }
    
}