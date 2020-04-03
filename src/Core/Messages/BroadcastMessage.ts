import { Message } from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { LstrSubtask } from "../Subtask/LstrSubtask";
import { SubtaskType } from "../../Constants/SubtaskConstants";
import { Logger } from "@nestjs/common";
import { SubtaskModelClass } from "../../Models/SubtaskModel";


export class BroadcastMessage extends Message{
    type = MessageType.BROADCAST;
    public listenerSubtasks:Array<LstrSubtask>;

    async createMessageModel(topic:string){
        let messageModel = await super.createMessageModel(topic);
        //TODO 创建lstr子任务
        messageModel.property('status',MessageStatus.DOING);//等待最后一个子任务完成时来标记message为done状态
        return messageModel;
    }

    async toDoing() {
        let listenerContexts = await this.getListenerContexts()
        await this.setProperty('listeners',listenerContexts).save();
        await this.createListenerSubtasks(listenerContexts)
        await this.setStatus(MessageStatus.DOING).save();
        return this;
    }

    private async getListenerContexts(){
        let listenerModels = await this.producer.actorManager.masterModels.ListenerModel.findAndLoad({
            topic: `${this.producer.name}@${this.topic}`
        })
        let listenerContexts = [];
        for (const listenerModel of listenerModels) {
            let context = {
                actor_id: listenerModel.property('actor_id'),
                processor: listenerModel.property('processor'),
                subtask_id: await this.producer.actorManager.getSubtaskGlobalId()//提前占用subtask_id
            }
            listenerContexts.push(context);
        }
        return listenerContexts;
    }
    
    private async createListenerSubtasks(listenerContexts){
        this.listenerSubtasks = [];
        for (const context of listenerContexts) {
            await this.addListenerSubtask(context)
            await this.incrPendingSubtaskTotal();
        }
        // let ids = await this.model.getAll(SubtaskModelClass.modelName);
        
        // Logger.debug(ids,'BcstSubtask Create Listener')
    }

    async addListenerSubtask(context){
       
        let body = {
            subtask_id: context.subtask_id,
            consumer_id: context.actor_id,
            processor: context.processor,
            data:{},
        }
        let subtask = <LstrSubtask>(await this.producer.subtaskManager.addSubtask(this,SubtaskType.LSTR,body))

        this.model.link(subtask.model);
        await this.model.save()
      

        await subtask.confirm();
        this.listenerSubtasks.push(subtask);
    }


    public async loadListenerSubtasks(){
        let subtaskIds = await this.model.getAll(SubtaskModelClass.modelName)

        let subtasks:Array<LstrSubtask> = [];
        for(var subtask_id of subtaskIds){
            let subtask:LstrSubtask = <LstrSubtask>(await this.producer.subtaskManager.getByFrom(this,subtask_id));
            subtasks.push(subtask);
        }
        this.listenerSubtasks = subtasks;
        return this;
    }


}