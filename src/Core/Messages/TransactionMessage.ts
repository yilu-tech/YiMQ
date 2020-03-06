import { Message } from "./Message";
import { MessageStatus } from "../../Constants/MessageConstants";
import { SubtaskType, SubtaskStatus } from "../../Constants/SubtaskConstants";
import { EcSubtask } from "../Subtask/EcSubtask";
import { TccSubtask } from "../Subtask/TccSubtask";
import { Subtask } from "../Subtask/Subtask";
import { Actor } from "../Actor";
import { BusinessException } from "../../Exceptions/BusinessException";


export class TransactionMessage extends Message{ 
    public subtasks:Map<number,Subtask> = new Map();  //事物的子项目

    constructor(producer:Actor,messageModel){
        super(producer,messageModel);



      for(const [index,subtaskJson] of Object.entries(messageModel.property('subtasks'))){
          this.subtasks.set(Number(index),this.subtaskFactory(subtaskJson['type'],subtaskJson))
      }
    }
    

    async statusToDoing():Promise<Message>{
        this.status = MessageStatus.DOING;
        await this.update();
        return this;
        
    }

    async statusToCancelling(){
        this.status = MessageStatus.CANCELLING;
        await this.update();
        return this;
    }

    async confirm():Promise<Message>{
        await this.statusToDoing();
        return this;
    }
    async addSubtask(type,processerName,data){
        let subtaskData:any = {};
        subtaskData.data = data;
        let now = new Date().getTime();
        subtaskData.id = await this.producer.actorManager.getTaskGlobalId();
        subtaskData.created_at = now;
        subtaskData.updated_at = now;
        subtaskData.processer = processerName;

        let subtask = this.subtaskFactory(type,subtaskData);
        this.subtasks.set(subtaskData.id,subtask);
        return subtask.prepare();
    }
    public getSubtask(index):any{
        if(!this.subtasks.has(index)){
            throw new BusinessException('subtask not exist.')
        }
        return this.subtasks.get(index);
    }
    async update():Promise<Message>{
        this.subtasksToJson();
        this.model.property('subtasks',this.subtasksToJson())

        await super.update();
        return this;
    }
    subtaskFactory(type,subtaskJson){
        let subtask:any;
        switch (type) {
            case SubtaskType.EC:
                subtask = new EcSubtask(this,type,subtaskJson);
                break;
            case SubtaskType.TCC:
                subtask = new TccSubtask(this,type,subtaskJson);
                break;
        
            default:
                throw new Error('SubtaskType is not exists.');
        }
        return subtask;
    }
    async cancel():Promise<Message>{
        this.statusToCancelling();
        return this.update();
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