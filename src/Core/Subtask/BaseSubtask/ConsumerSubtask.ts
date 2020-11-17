import { Subtask } from "./Subtask";
import { Actor } from "../../Actor";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { SubtaskJob } from "../../Job/SubtaskJob";
import { SubtaskStatus } from "../../../Constants/SubtaskConstants";
import { JobType } from "../../../Constants/JobConstants";
import { Expose } from "class-transformer";
import { OnDemand } from "../../../Decorators/OnDemand";
import { ExposeGroups, OnDemandSwitch } from "../../../Constants/ToJsonConstants";
import { JobsOptions } from "bullmq";

export abstract class ConsumerSubtask extends Subtask{
    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public consumer:Actor;
    @Expose()
    consumer_id:number;
    // @Expose()
    // consumerprocessorName:string;

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

    public async restore(subtaskModel,full=false){
        await super.restore(subtaskModel);
        if(full){
            await this.loadJob();
        }
    }
    @OnDemand(OnDemandSwitch.SUBTASK_JOB)
    public async loadJob(){
        if(Number(this.job_id) > -1){
            let jobContext = await this.consumer.coordinator.getJob(this.job_id);
            this.job = new SubtaskJob(this,jobContext);
            await this.job.restore();
            //this.job = await this.consumer.jobManager.get(this.job_id); //不用这句的原因是这句又要重新去查this
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
        let jobOptions:JobsOptions= {
            jobId: await this.message.producer.actorManager.getJobGlobalId()
        }
        await this.setJobId(jobOptions.jobId).save();//先保存job_id占位
        await this.setStatus(status).save();//先添加job有可能会导致job开始执行，subtask的状态还未修改，导致出错
        this.job = await this.consumer.jobManager.add(this,JobType.SUBTASK,jobOptions)
    }

}