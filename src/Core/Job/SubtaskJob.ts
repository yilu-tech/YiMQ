import { Job } from "./Job";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import * as bull from 'bull';
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { SystemException } from "../../Exceptions/SystemException";
import { Expose } from "class-transformer";
import { BeforeToJsonSwitch, ExposeGroups } from "../../Constants/ToJsonConstants";
export class SubtaskJob extends Job{
    @Expose()
    public subtask_id:Number;
    @Expose({groups:[ExposeGroups.JOB_PARENT]})
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
            case SubtaskStatus.CANCELLING://todo:: cancled情况可以考虑允许重复取消，因为job里面调整了subtask状态，但job失败了
                result = await this.subtask.toCancel();
                break;
            case SubtaskStatus.PREPARING:
                throw new SystemException('SubtaskStatus is PENDING');
            case SubtaskStatus.PREPARED:
                throw new SystemException('SubtaskStatus is PREPARED');
            case SubtaskStatus.DONE://todo:: 已经done情况可以考虑return job成功，因为job里面调整了subtask状态为done，只是job失败了
                throw new SystemException(`SubtaskStatus is DONE can not to process.`);
            default:
                throw new SystemException(`SubtaskStatus <${this.subtask.status}> is not exists.`);
        }
        return result;
    }

    public async beforeToJson(switchs:BeforeToJsonSwitch[]=[]){
        await super.beforeToJson(switchs);
        await this.subtask.beforeToJson(switchs);
    }
}