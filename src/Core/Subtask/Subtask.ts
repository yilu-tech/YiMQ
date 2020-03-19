import { SubtaskType, SubtaskStatus } from "../../Constants/SubtaskConstants";
import { Message } from "../Messages/Message";
import { Actor } from "../Actor";
import { SubtaskModelClass } from "../../Models/SubtaskModel";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { CoordinatorCallActorAction } from "../../Constants/Coordinator";
import * as bull from 'bull';
import { BusinessException } from "../../Exceptions/BusinessException";
import { TransactionMessage } from "../Messages/TransactionMessage";
import { MessageStatus } from "../../Constants/MessageConstants";
export abstract class Subtask{
    id:Number;
    job_id:number;
    type:SubtaskType;
    status: SubtaskStatus;
    data:any;
    created_at:Number;
    updated_at:Number;
    processor:string;

    consumer:Actor;
    consumerprocessorName:string;


    message:TransactionMessage;
    model:SubtaskModelClass
    job:Job;
    constructor(message:TransactionMessage,subtaskModel){
        this.model = subtaskModel;
        this.message = message;

        this.id = subtaskModel.id;
        this.job_id = subtaskModel.property('job_id');
        this.type = subtaskModel.property('type');
        this.status = subtaskModel.property('status');
        this.data = subtaskModel.property('data');
        this.created_at = subtaskModel.property('created_at');
        this.updated_at = subtaskModel.property('updated_at');
        this.processor = subtaskModel.property('processor');
       
        let [consumerName,consumerprocessorName] =this.processor.split('@');
        this.consumer = this.message.producer.actorManager.get(consumerName);
        if(!this.consumer){
            throw new BusinessException(`Consumer <${consumerName}> not exists.`)
        }
        this.consumerprocessorName = consumerprocessorName;


    }

    abstract async prepare();


 
    async setStatusAddJobFor(status:SubtaskStatus){
        this.status = status;
        let jobOptions:bull.JobOptions = {
            jobId: await this.message.producer.actorManager.getJobGlobalId()
        }
        await this.setJobId(jobOptions.jobId).save();//先保存job_id占位
        this.job = await this.consumer.jobManager.add(this,JobType.TRANSACTION_SUBTASK,jobOptions)
        await this.setStatus(status).save();
    }
    
    async toDo(){
        let callContext = {
            message_id: this.message.id,
            subtask_id: this.id
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.setStatus(SubtaskStatus.DONE).save();
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.DONE);
        }
        return result.data;
    }
    async toCancel(){
        let callContext = {
            message_id: this.message.id,
            subtask_id: this.id
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        await this.setStatus(SubtaskStatus.CANCELED).save()
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.CANCELED);
        }
        return result.data;
    }
    setJobId(jobId){
        this.job_id = jobId;
        this.model.property('job_id',this.job_id);
        return this;
    }
    setStatus(status:SubtaskStatus){
        this.status = status;
        this.model.property('status',this.status);
        return this;
    }
    async save(){
        return this.model.save();
    }

    public getJobID(){
        return this.model.property('job_id');
    }

      /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['message'];
        delete json['consumer'];
        delete json['consumerprocessorName'];
        delete json['model'];
        return json;
    }
    
}