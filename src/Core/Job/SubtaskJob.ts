import { Job } from "./Job";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import * as bull from 'bull';
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { SystemException } from "../../Exceptions/SystemException";
export class SubtaskJob extends Job{
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
            case SubtaskStatus.PREPARED:
                throw new SystemException('SubtaskStatus is PREPARED');
            case SubtaskStatus.DONE:
                throw new SystemException('SubtaskStatus is DONE');
            default:
                throw new SystemException(`SubtaskStatus <${this.subtask.status}> is not exists.`);
        }
        return result;
    }

    public toJson(full=false){
        let json = super.toJson(full);
        delete json['subtask'];
        return json;
    }
}