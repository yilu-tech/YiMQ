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
import { TransactionSubtaskJob } from "../Job/TransactionSubtaskJob";
export abstract class Subtask{
    id:Number;
    job_id:number;
    type:SubtaskType;
    status: SubtaskStatus;
    data:any;
    created_at:Number;
    updated_at:Number;
    processor:string;
    parent_id:string;

    consumer:Actor;
    consumer_id:number;
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
        this.parent_id = subtaskModel.property('parent_id');

        this.consumer_id = subtaskModel.property('consumer_id');
        this.processor = subtaskModel.property('processor');
        this.consumer = this.message.producer.actorManager.getById(this.consumer_id)


    }

    abstract async prepare();


    public async restore(){
        if(this.job_id > -1){
            let jobContext = await this.consumer.coordinator.getJob(this.job_id);
            this.job = new TransactionSubtaskJob(this,jobContext);
        }
    }

    public async confirm(){
        await this.setStatusAddJobFor(SubtaskStatus.DOING);
    }
    public async cancel(){
        await this.setStatusAddJobFor(SubtaskStatus.CANCELLING)
    }
 
    private async setStatusAddJobFor(status:SubtaskStatus.DOING|SubtaskStatus.CANCELLING){
        this.status = status;
        let jobOptions:bull.JobOptions = {
            jobId: await this.message.producer.actorManager.getJobGlobalId()
        }
        await this.setJobId(jobOptions.jobId).save();//先保存job_id占位
        await this.setStatus(status).save();//先添加job有可能会导致job开始执行，subtask的状态还未修改，导致出错
        this.job = await this.consumer.jobManager.add(this,JobType.TRANSACTION_SUBTASK,jobOptions)

    }
    
    abstract async toDo();
    abstract async toCancel();
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
    setProperty(name,value){
        this[name] = value;
        this.model.property(name,value);
        return this;
    }
    public getDbHash(){
        console.log(this.model['nohmClass'].prefix)
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    public async completeAndSetMeesageStatusByScript(status,messageStatus:MessageStatus){
        try {
            return await this.message.producer.redisClient['subtaskCompleteAndSetMessageStatus'](this.id,this.message.id,status,messageStatus);    
        } catch (error) {
            console.error(error)
            throw error;
        }   
    }
    public async completeAndSetMeesageStatus(status,messageStatus){
        let [subtaskUpdatedStatus,
            messageCurrentStatus,
            pendingSubtaskTotal,
            messageUpdatedStatus
        ] = await this.completeAndSetMeesageStatusByScript(status,messageStatus);
        
        //修改instance中的值,但是不save,防止其他地方用到
        this.setStatus(subtaskUpdatedStatus); 
        this.message.setStatus(messageUpdatedStatus);
        return pendingSubtaskTotal;
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