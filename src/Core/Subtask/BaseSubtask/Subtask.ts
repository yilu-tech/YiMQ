import { SubtaskType, SubtaskStatus } from "../../../Constants/SubtaskConstants";
import { SubtaskModelClass } from "../../../Models/SubtaskModel";
import { Job } from "../../Job/Job";
import { TransactionMessage } from "../../Messages/TransactionMessage";
import { MessageStatus } from "../../../Constants/MessageConstants";
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




    message:TransactionMessage;
    model:SubtaskModelClass
    job:Job;
    constructor(message:TransactionMessage){
        
        this.message = message;
    }
    protected async initProperties(subtaskModel){
        this.model = subtaskModel;
        this.id = subtaskModel.id;
        this.job_id = subtaskModel.property('job_id');
        // this.type = subtaskModel.property('type');
        this.status = subtaskModel.property('status');
        this.data = subtaskModel.property('data');
        this.created_at = subtaskModel.property('created_at');
        this.updated_at = subtaskModel.property('updated_at');
        this.parent_id = subtaskModel.property('parent_id');
    }
    public async createSubtaskModel(body){
        
        let subtaskModel = new this.message.producer.subtaskModel();
        subtaskModel.id = body.subtask_id; 

        subtaskModel.property('parent_id',this.message.id);//rename parent_id

        subtaskModel.property('type',this.type);
        subtaskModel.property('status',SubtaskStatus.PREPARING);
        subtaskModel.property('data',body.data);
        subtaskModel.property('updated_at',new Date().getTime());
        subtaskModel.property('created_at',new Date().getTime());
        return subtaskModel;
    }

    public async create(body){
        let subtaskModel  = await this.createSubtaskModel(body);
        await subtaskModel.save() 
        await this.initProperties(subtaskModel)
    }
    async restore(subtaskModel){
        await this.initProperties(subtaskModel);
    };
    abstract async prepare();
    abstract async confirm();
    abstract async cancel();
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
        return this.message.producer.redisClient['subtaskCompleteAndSetMessageStatus'](this.id,this.message.id,'updated_at',status,messageStatus,new Date().getTime());    
    }
    public async completeAndSetMeesageStatus(status,messageStatus){

            var [subtaskUpdatedStatus,
                messageCurrentStatus,
                pendingSubtaskTotal,
                messageUpdatedStatus,
            ] = await this.completeAndSetMeesageStatusByScript(status,messageStatus);    
  
        
        //修改instance中的值,但是不save,防止其他地方用到
        this.setStatus(subtaskUpdatedStatus); 
        this.message.setStatus(messageUpdatedStatus);
        return pendingSubtaskTotal;
    }
    async save(){
        this.model.property('updated_at',new Date().getTime());
        return this.model.save();
    }

    public getJobID(){
        return this.model.property('job_id');
    }
    public async delete(){
        await this.model.remove();
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