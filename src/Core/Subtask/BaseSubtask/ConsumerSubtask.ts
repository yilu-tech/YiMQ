import { Subtask } from "./Subtask";
import { Actor } from "../../Actor";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { SubtaskJob } from "../../Job/SubtaskJob";
import { SubtaskStatus } from "../../../Constants/SubtaskConstants";
import * as bull from 'bull';
import { JobType } from "../../../Constants/JobConstants";
import { Expose } from "class-transformer";
import { OnDemand } from "../../../Decorators/OnDemand";
import { ExposeGroups, OnDemandSwitch } from "../../../Constants/ToJsonConstants";
import { CoordinatorProcessResult } from "../../Coordinator/Coordinator";
import { Logger } from "@nestjs/common";
import { Job } from "../../Job/Job";

export abstract class ConsumerSubtask extends Subtask{
    @Expose()
    job_id:number;


    @Expose({groups:[ExposeGroups.SUBTASK_JOB]})
    job:Job; 


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
        this.job_id = subtaskModel.property('job_id');

        this.consumer_id = subtaskModel.property('consumer_id');
        this.processor = subtaskModel.property('processor');
        this.consumer = this.message.producer.actorManager.getById(this.consumer_id)
       
    }

    public async restore(subtaskModel){
        await super.restore(subtaskModel);
    }
    @OnDemand(OnDemandSwitch.SUBTASK_JOB)
    public async loadJob(){
        if(this.job_id > -1){
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
    abstract async toDo():Promise<CoordinatorProcessResult>;
    abstract async toCancel():Promise<CoordinatorProcessResult>;;

    setJobId(jobId){
        this.job_id = jobId;
        this.model.property('job_id',this.job_id);
        return this;
    }

    private async setStatusAddJobFor(status:SubtaskStatus.DOING|SubtaskStatus.CANCELLING){
        await this.loadJob();

        if(this.job){ //如果job存在，就不再添加job
            Logger.warn(`Actor:${this.producer.id} Subtask:${this.id} status is ${status} repeat adding job.`,`ConsumerSubtask`)
        }else{
            this.setJobId(await this.message.producer.actorManager.getJobGlobalId()) //先保存job_id占位
        }
        await this.setStatus(status).save()
        //先添加job有可能会导致job开始执行，subtask的状态还未修改，导致出错,如果创建失败，message会重试，最终job会创建成功
        let defaultBackoff = {
            type:'standard',
        }
        if(!this.job){ //如果job不存在就添加job
            let jobOptions:bull.JobOptions = {
                jobId: this.job_id,
                delay: this.options.delay || 0,
                attempts: this.options.attempts || 18,
                backoff: this.options.backoff || defaultBackoff
            }
            this.job = await this.consumer.jobManager.add(this,JobType.SUBTASK,jobOptions)
        }
    }

    public async setHealth(procesSuccess:boolean){
        let redisMulti = this.producer.redisClient.multi();
        if(procesSuccess == false && this.job.attemptsMade >= 2 ){ //0，1，2 第二次尝试之后
            this.model.property('is_health',false)
            
        }else{
            this.model.property('is_health',true)
            
        }

        await this.model.save({redisMulti: redisMulti});
        redisMulti['messageHealthCheck_command'](this.message.getMessageHash())
        let results = await redisMulti.exec();
        this.throwMulitError(results)
    }

    throwMulitError(results){
        for(let result of results){
            if(result[0] != null){
                throw new Error(JSON.stringify(result[0]))
            }
        }
    }

    public async delete(){
        await this.loadJob();
        this.job && await this.job.remove()    
        await super.delete();
    }
}