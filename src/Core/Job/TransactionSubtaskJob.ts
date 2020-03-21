import { Job } from "./Job";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { Subtask } from "../Subtask/Subtask";
import { Message } from "../Messages/Message";
import * as bull from 'bull';
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { CoordinatorCallActorAction } from "../../Constants/Coordinator";
import { SystemException } from "../../Exceptions/SystemException";
export class TransactionSubtaskJob extends Job{
    public subtask_id:Number;
    public subtask:Subtask;
    constructor(subtask:Subtask,public readonly context:bull.Job){
        super(context);
        this.subtask = subtask;
        this.subtask_id = subtask.id;
    }
    async process() {
        let result;
        switch (this.subtask.status) {
            //重复做到成功为止
            case SubtaskStatus.DOING:
                result = await this.subtask.toDo();
                break;
            case SubtaskStatus.CANCELLING:
                result = await this.subtask.toCancel();
                break;
            case SubtaskStatus.PREPARING:
                throw new SystemException('SubtaskStatus is PENDING');
            case SubtaskStatus.DONE:
                throw new SystemException('SubtaskStatus is DONE');
                break;
            default:
                throw new SystemException('SubtaskStatus is not exists.');
        }
        return result;
    }
}