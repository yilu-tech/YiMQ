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
    message_id:string;

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
        this.message_id = subtaskModel.property('message_id');

        //TODO 是否要单独抽一个基类
        if(this.processor){
            let [consumerName,consumerprocessorName] =this.processor.split('@');
            this.consumer = this.message.producer.actorManager.get(consumerName);
            if(!this.consumer){
                throw new BusinessException(`Consumer <${consumerName}> not exists.`)
            }
            this.consumerprocessorName = consumerprocessorName;
        }


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
    public getDbHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    public async completeAndSetMeesageStatusByScript(status,messageStatus:MessageStatus){
        try {
            return await this.message.producer.redisClient['subtaskCompleteAndSetMessageStatus'](this.getDbHash(),this.message.getMessageHash(),status,messageStatus);    
        } catch (error) {
            console.error(error)
            throw error;
        }   
    }
    public async completeAndSetMeesageStatus(status,messageStatus){
        let [subtaskStatus,
            currentMessageStatus,
            pendingSubtaskTotal,
            updatedMessageStatus
        ] = await this.completeAndSetMeesageStatusByScript(status,messageStatus);
        /**
         * 这里先通过script修改了数据库，保证一致性，然后又用norm操作一次，更新索引
         */
        await this.setStatus(status).save()
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(messageStatus);
        }
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