import { Job } from "./Job";
import { Subtask } from "../Subtask/BaseSubtask/Subtask";
import * as bull from 'bull';
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { SystemException } from "../../Exceptions/SystemException";
import { Exclude, Expose } from "class-transformer";
import { ExposeGroups } from "../../Constants/ToJsonConstants";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { ConsumerSubtask } from "../Subtask/BaseSubtask/ConsumerSubtask";
import { JobStatus, JobType } from "../../Constants/JobConstants";
import { JobCreateTransactionCallback, TransactionCallback } from "../../Handlers";
import { JobOptions } from "../../Interfaces/JobOptions";
import { ClientSession } from "mongoose";
@Exclude()
export class SubtaskJob extends Job{
    @Expose()
    public subtask_id:string;
    @Expose({groups:[ExposeGroups.JOB_PARENT]})
    public subtask:ConsumerSubtask;


    public type = JobType.SUBTASK
    constructor(subtask:ConsumerSubtask){
        super(subtask.producer);
        this.subtask = subtask;
        this.relation_id = subtask.id;
    }

    public async create(jobOptions:JobOptions,session:ClientSession){
        this.model.status = JobStatus.PENDING;
        await super.create(jobOptions,session);
        return this;
    }

    async process() {
       try {
        let result:CoordinatorProcessResult;
        switch (this.subtask.status) {
            //重复做到成功为止
            case SubtaskStatus.DOING:
                result = await this.subtask.toDo();
                result.action = 'toDo';
                break;
            case SubtaskStatus.CANCELLING://todo:: cancled情况可以考虑允许重复取消，因为job里面调整了subtask状态，但job失败了
                result = await this.subtask.toCancel();
                result.action = 'toCancel';
                break;
            case SubtaskStatus.PREPARING:
                throw new SystemException('SubtaskStatus is PREPARING');
            case SubtaskStatus.PREPARED:
                throw new SystemException('SubtaskStatus is PREPARED');
            case SubtaskStatus.DONE://todo:: 已经done情况可以考虑return job成功，因为job里面调整了subtask状态为done，只是job失败了
                throw new SystemException(`SubtaskStatus is DONE can not to process.`);
            default:
                throw new SystemException(`SubtaskStatus <${this.subtask.status}> is not exists.`);
        }
        await this.subtask.setHealth(true)
        return result;
           
       } catch (error) {
           await this.subtask.setHealth(false)
           throw error;
       }
    }
}