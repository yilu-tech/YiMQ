import { Subtask } from "./Subtask";
import { Actor } from "../../Actor";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { SubtaskJob } from "../../Job/SubtaskJob";
import { SubtaskStatus } from "../../../Constants/SubtaskConstants";
import * as bull from 'bull';
import { JobType } from "../../../Constants/JobConstants";

export abstract class ConsumerSubtask extends Subtask{
    consumer:Actor;
    consumer_id:number;
    consumerprocessorName:string;

    constructor(message:TransactionMessage){
        super(message);
    }

    public async createSubtaskModel(body){
        let subtaskModel = await super.createSubtaskModel(body);
        subtaskModel.property('consumer_id',body.consumer_id);
        subtaskModel.property('processor',body.processor);
        return subtaskModel;
    }

    async initProperties(subtaskModel){     
        await super.initProperties(subtaskModel);
        this.consumer_id = subtaskModel.property('consumer_id');
        this.processor = subtaskModel.property('processor');
        this.consumer = this.message.producer.actorManager.getById(this.consumer_id)
       
    }

    public async restore(subtaskModel){
        await super.restore(subtaskModel);
        if(this.job_id > -1){
            let jobContext = await this.consumer.coordinator.getJob(this.job_id);
            this.job = new SubtaskJob(this,jobContext);
        }
    }

    public async confirm(){
        await this.setStatusAddJobFor(SubtaskStatus.DOING);
    }
    public async cancel(){
        await this.setStatusAddJobFor(SubtaskStatus.CANCELLING)
    }
    abstract async toDo();
    abstract async toCancel();

    private async setStatusAddJobFor(status:SubtaskStatus.DOING|SubtaskStatus.CANCELLING){
        this.status = status;
        let jobOptions:bull.JobOptions = {
            jobId: await this.message.producer.actorManager.getJobGlobalId()
        }
        await this.setJobId(jobOptions.jobId).save();//先保存job_id占位
        await this.setStatus(status).save();//先添加job有可能会导致job开始执行，subtask的状态还未修改，导致出错
        this.job = await this.consumer.jobManager.add(this,JobType.SUBTASK,jobOptions)
    }

}