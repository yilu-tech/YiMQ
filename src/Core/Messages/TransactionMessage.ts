import { Message } from "./Message";
import { MessageStatus } from "../../Constants/MessageConstants";
import { SubtaskType, SubtaskStatus } from "../../Constants/SubtaskConstants";
import { EcSubtask } from "../Subtask/EcSubtask";
import { TccSubtask } from "../Subtask/TccSubtask";
import { Subtask } from "../Subtask/Subtask";
import { Actor } from "../Actor";
import { BusinessException } from "../../Exceptions/BusinessException";
import { SubtaskModelClass } from "../../Models/SubtaskModel"
import { TransactionMessageJob } from "../Job/TransactionMessageJob";
import { XaSubtask } from "../Subtask/XaSubtask";
export class TransactionMessage extends Message{
    public subtasks:Array<Subtask> = [];  //事物的子项目
    public pending_subtask_total:number;

    constructor(producer:Actor,messageModel){
        super(producer,messageModel);
        this.pending_subtask_total = messageModel.property('pending_subtask_total');
    }



    async toDoing():Promise<Message>{
        // for (const subtask of this.message.subtasks) {
        //     await subtask.statusToDoing();
        // }
        //并行执行
        //TODO 增加防重复执行，导致重复给subtask添加任务,其中一个创建失败，再次尝试的时候，要避免已经成功的重复创建
        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.setStatusAddJobFor(SubtaskStatus.DOING)
        }))

        await this.setStatus(MessageStatus.DOING);
        return this;
        
    }

    async toCancelling(){
        await Promise.all(this.subtasks.map((subtask)=>{
            return subtask.setStatusAddJobFor(SubtaskStatus.CANCELLING)
        }))
        await this.setStatus(MessageStatus.CANCELLING);
        return this;
    }

    async confirm():Promise<Message>{
        if(this.status != MessageStatus.PENDING){
            throw new BusinessException(`The status of this message is ${this.status} instead of ${MessageStatus.PENDING} `);
        }
        await this.setStatus(MessageStatus.DOING);
        await this.job.context.promote();//立即执行job
        return this;
    }
    async prepare(body){
        let data = {
            id:  this.id,
            ec_subtasks : []
        };
        if(body.ec_subtasks && body.ec_subtasks.length > 0 ){
            data.ec_subtasks = await this.prepareEcSubtasks(body.ec_subtasks);
        }
        return data;   
    }
    private async prepareEcSubtasks(ecSubtasksBody){
        let ecSubtasksResult = [];
        for (const ecSubtaskBody of ecSubtasksBody) {
            let ecSubtask = await this.addSubtask(SubtaskType.EC,ecSubtaskBody.processor,ecSubtaskBody.data);
            ecSubtasksResult.push(ecSubtask.toJson());
        }
        return ecSubtasksResult;
    }
    async cancel():Promise<Message>{
        if(this.status != MessageStatus.PENDING){
            throw new BusinessException(`The status of this message is ${this.status} instead of ${MessageStatus.PENDING} `);
        }
        await this.setStatus(MessageStatus.CANCELLING);
        await this.job.context.promote();//立即执行job
        return this.update();
    }
    /**
     * 用于MessageManager get的时候重建信息
     */
    async restore(){
        let jobContext = await this.producer.coordinator.getJob(this.job_id);
        this.job = new TransactionMessageJob(this,jobContext);
        this.subtasks = await this.getAllSubtasks();
    }
    async addSubtask(type,processorName,data){
        if(this.status != MessageStatus.PENDING){
            throw new BusinessException(`The status of this message is ${this.status} instead of ${MessageStatus.PENDING}`);
        }
        let now = new Date().getTime();

        let subtaskModel = new this.producer.subtaskModel();
        subtaskModel.id = String(await this.producer.actorManager.getSubtaskGlobalId());
        subtaskModel.property('message_id',this.id);
        subtaskModel.property('type',type);
        subtaskModel.property('status',SubtaskStatus.PREPARING);
        subtaskModel.property('data',data);
        subtaskModel.property('created_at',now);
        subtaskModel.property('updated_at',now);
        subtaskModel.property('processor',processorName);
        await subtaskModel.save() 
        this.model.link(subtaskModel);
        await this.model.save()
        await this.incrPendingSubtaskTotal();

        let subtask = this.subtaskFactory(type,subtaskModel);
        this.subtasks.push(subtask);
        return subtask.prepare();
    }
    private async incrPendingSubtaskTotal(){
        return this.producer.redisClient.hincrby(this.getMessageHash(),'pending_subtask_total',1);
    }
    public async decrPendingSubtaskTotal(){
        return this.producer.redisClient.hincrby(this.getMessageHash(),'pending_subtask_total',-1);
    }
    private getMessageHash(){
        return `${this.model['nohmClass'].prefix.hash}${this.model.modelName}:${this.id}`;
    }
    public async getAllSubtasks():Promise<Array<Subtask>>{
        let subtaskIds = await this.model.getAll(SubtaskModelClass.modelName)
        let subtaskModels = await this.producer.subtaskModel.loadMany(subtaskIds)
        let subtasks:Array<Subtask> = [];
        for(var i in subtaskModels){
            let subtaskModel = subtaskModels[i];
            let subtask = this.subtaskFactory(subtaskModel.property('type'),subtaskModel);
            subtasks.push(subtask);
        }
        return subtasks;
    }
    public getSubtask(subtask_id):any{
        return this.subtasks.find((subtask)=>{
            return subtask.id == subtask_id
        })
    }
    async update():Promise<Message>{
        this.subtasksToJson();

        await super.update();
        return this;
    }
    subtaskFactory(type,subtaskModel){
        let subtask:any;
        switch (type) {
            case SubtaskType.EC:
                subtask = new EcSubtask(this,subtaskModel);
                break;
            case SubtaskType.TCC:
                subtask = new TccSubtask(this,subtaskModel);
                break;
            case SubtaskType.XA:
                subtask = new XaSubtask(this,subtaskModel);
                break;
        
            default:
                throw new Error('SubtaskType is not exists.');
        }
        return subtask;
    }

    private subtasksToJson(){
        let subtasks = {};
        this.subtasks.forEach((subtask,index)=>{
            subtasks[`${index}`] = subtask.toJson();
        })
        return subtasks;
    }
    toJson(){
        let json = super.toJson();
        json['subtasks'] = this.subtasksToJson();
        return json;
    }
}