import { Subtask } from "./Subtask";
import { Actor } from "../../Actor";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { SubtaskJob } from "../../Job/SubtaskJob";
import { SubtaskStatus } from "../../../Constants/SubtaskConstants";
import * as bull from 'bull';
import { JobStatus, JobType } from "../../../Constants/JobConstants";
import { Expose } from "class-transformer";
import { OnDemand } from "../../../Decorators/OnDemand";
import { ExposeGroups, OnDemandSwitch } from "../../../Constants/ToJsonConstants";
import { CoordinatorProcessResult } from "../../Coordinator/Coordinator";
import { Logger } from "@nestjs/common";
import { SubtaskModel } from "../../../Models/SubtaskModel";
import { BusinessException } from "../../../Exceptions/BusinessException";
import { JobOptions } from "../../../Interfaces/JobOptions";
import { TransactionCallback } from "../../../Handlers";
import { ClientSession } from "mongoose";

export abstract class ConsumerSubtask extends Subtask{
    @Expose()
    job_id:string;


    @Expose({groups:[ExposeGroups.SUBTASK_JOB]})
    job:SubtaskJob; 


    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public consumer:Actor;
    @Expose()
    consumer_id:number;
    // @Expose()
    // consumerprocessorName:string;

    constructor(message:TransactionMessage){
        super(message);
    }

    // public async createSubtaskModel(body){
    //     let subtaskModel = await super.createSubtaskModel(body);

    //     let {consumer,consumerProcessorName} = this.producer.subtaskManager.getConsumerAndProcessor(body.processor);
    //     subtaskModel.consumer_id = consumer.id;
    //     subtaskModel.processor = consumerProcessorName;

    //     return subtaskModel;
    // }

    public async createModel(body){
        await super.createModel(body);
        let {consumer,consumerProcessorName} = this.producer.subtaskManager.getConsumerAndProcessor(body.processor);
        this.model.consumer_id = consumer.id;
        this.model.processor = consumerProcessorName;
        this.consumer = consumer;
    }
    public async create(body,session:ClientSession){
        await this.createModel(body)
        let subtaskJobOptions:JobOptions = {
            delay: body.options?.delay || 0,
            attempts: body.options?.attempts || 10
        }
        this.id = this.model._id;//提前初始化_id到对象，用于创建job
        //为了不把job相关的配置在subtask中再存储一次，创建subtask的时候就把job创建好
        this.job = <SubtaskJob>this.consumer.jobManager.factory(this,JobType.SUBTASK);
        await this.job.create(subtaskJobOptions,session);
        this.model.job_id = this.job.id;

        await this.model.save({session});
        await this.initProperties(this.model);
    }
    async initProperties(subtaskModel:SubtaskModel){     
        await super.initProperties(subtaskModel);
        this.job_id = subtaskModel.job_id.toHexString();

        this.consumer_id = subtaskModel.consumer_id;
        this.processor = subtaskModel.processor;
    }

    public async restore(subtaskModel){
        await super.restore(subtaskModel);
        this.consumer = this.message.producer.actorManager.getById(this.consumer_id)
    }
    @OnDemand(OnDemandSwitch.SUBTASK_JOB)
    public async loadJob(){
        let jobModel = await this.producer.jobManager.getJobModel(this.job_id);
        this.job = new SubtaskJob(this);
        await this.job.restore(jobModel);
        return this;
    }

    public async confirm(){
        if(this.status != SubtaskStatus.PREPARED){
            throw new BusinessException('SUBTASK_CONFIRM_CURRENT_STATUS_MISTAKE',{currentStatus:this.status});
        }
        await this.loadJob();
        await this.job.promote(async(session)=>{
            await this.setStatus(SubtaskStatus.PREPARED,SubtaskStatus.DOING,session);
        })

    }
    public async cancel(){
        if(![SubtaskStatus.PREPARING,SubtaskStatus.PREPARED].includes(this.status)){ //tcc在PREPARING状态下也可以cancle
            throw new BusinessException('SUBTASK_CANCEL_CURRENT_STATUS_MISTAKE',{currentStatus:this.status});
        }
        await this.loadJob();
        await this.job.promote(async(session)=>{
            await this.setStatus(this.status,SubtaskStatus.CANCELLING,session);
        })
    }
    // abstract cancel():Promise<void>
    abstract toDo():Promise<CoordinatorProcessResult>;
    abstract toCancel():Promise<CoordinatorProcessResult>;;

    setJobId(jobId){
        this.job_id = jobId;
        // this.model.property('job_id',this.job_id);
        return this;
    }

    public async toProcessAndSetJobToDelay(status:SubtaskStatus.DOING|SubtaskStatus.CANCELLING){
        await this.loadJob();
        await this.job.setStatusWithTransacation(JobStatus.PENDING,JobStatus.DELAYED,async(session)=>{
            await this.setStatus(SubtaskStatus.PREPARED,status,session);
        })
    }


    public async setHealth(procesSuccess:boolean){
        let redisMulti = this.producer.redisClient.multi();
        if(procesSuccess == false && this.job.attemptsMade >= 2 ){ //0，1，2 第二次尝试之后
            // this.model.property('is_health',false)
            
        }else{
            // this.model.property('is_health',true)
            
        }

        // await this.model.save({redisMulti: redisMulti});
        // redisMulti['messageHealthCheck_command'](this.message.getMessageHash())
        // let results = await redisMulti.exec();
        // this.throwMulitError(results)
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