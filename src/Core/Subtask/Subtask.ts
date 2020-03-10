import { SubtaskType, SubtaskStatus } from "../../Constants/SubtaskConstants";
import { Message } from "../Messages/Message";
import { Actor } from "../Actor";
import { SubtaskModelClass } from "../../Models/SubtaskModel";
import { Job } from "../Job/Job";
import { JobType } from "../../Constants/JobConstants";
import { CoordinatorCallActorAction } from "../../Constants/Coordinator";
export abstract class Subtask{
    id:Number;
    job_id:Number;
    type:SubtaskType;
    status: SubtaskStatus;
    data:any;
    created_at:Number;
    updated_at:Number;
    processer:string;

    consumer:Actor;
    consumerProcesserName:string;


    message:Message;
    model:SubtaskModelClass
    job:Job;
    constructor(message:Message,subtaskModel){
        this.model = subtaskModel;
        this.message = message;

        this.id = subtaskModel.id;
        this.job_id = subtaskModel.property('job_id');
        this.type = subtaskModel.property('type');
        this.status = subtaskModel.property('status');
        this.data = subtaskModel.property('data');
        this.created_at = subtaskModel.property('created_at');
        this.updated_at = subtaskModel.property('updated_at');
        this.processer = subtaskModel.property('processer');
       
        let [consumerName,consumerProcesserName] =this.processer.split('@');
        this.consumer = this.message.producer.actorManager.get(consumerName);
        this.consumerProcesserName = consumerProcesserName;


    }

    abstract async prepare();


 
    async setStatusAddJobFor(status:SubtaskStatus){
        this.status = status;
        this.job = await this.consumer.jobManager.add(this,JobType.TRANSACTION_SUBTASK)
        this.job_id = this.job.id;
        this.model.property('job_id',this.job_id);//和status一起保存
        await this.setStatus(status).save();
    }
    
    async toDo(){
        let callContext = {
            message_id: this.message.id,
            subtask_id: this.id
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.setStatus(SubtaskStatus.DONE).save();
        return result.data;
    }
    async toCancel(){
        let callContext = {
            message_id: this.message.id,
            subtask_id: this.id
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);

        await this.setStatus(SubtaskStatus.CANCELED).save()
        return result.data;
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
        delete json['consumerProcesserName'];
        delete json['model'];
        return json;
    }
    
}