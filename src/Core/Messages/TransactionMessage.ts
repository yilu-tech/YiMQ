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
import * as bull from 'bull';
export class TransactionMessage extends Message{
    public subtasks:Array<Subtask> = [];  //事物的子项目

    constructor(producer:Actor,messageModel){
        super(producer,messageModel);
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
    async addSubtask(type,processerName,data){
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
        subtaskModel.property('processer',processerName);
        await subtaskModel.save() 
        this.model.link(subtaskModel);
        await this.model.save()
    
        let subtask = this.subtaskFactory(type,subtaskModel);
        this.subtasks.push(subtask);
        return subtask.prepare();
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
        this.model.property('subtasks',this.subtasksToJson())

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
        return json;
    }
}