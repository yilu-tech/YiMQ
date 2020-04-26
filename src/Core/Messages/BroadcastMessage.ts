import { Message } from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { LstrSubtask } from "../Subtask/LstrSubtask";
import { SubtaskType } from "../../Constants/SubtaskConstants";
import { SubtaskModelClass } from "../../Models/SubtaskModel";


export class BroadcastMessage extends Message{
    public type = MessageType.BROADCAST;
    public context:object = {};

    async createMessageModel(topic:string,data){
        await super.createMessageModel(topic,data);
        this.model.property('status',MessageStatus.DOING);//等待最后一个子任务完成时来标记message为done状态
        return this;
    }

    /**
     * 用于BcstSubtask设置上下文
     * @param context { bcst_subtask_id: '1' }
     */
    setContext(context){
        this.context = context;
        this.model.property('context',context);
    }

    async toDoing() {
        let listeners = await this.getListeners()
        await this.setProperty('subtask_contexts',listeners).save();
        await this.createListenerSubtasks(listeners)
        await this.setStatus(MessageStatus.DOING).save();
        return this;
    }

    private async getListeners(){
        let listenerModels = await this.producer.actorManager.masterModels.ListenerModel.findAndLoad({
            topic: `${this.producer.name}@${this.topic}`
        })
        let listenerContexts = [];
        for (const listenerModel of listenerModels) {
            let context = {
                consumer_id: listenerModel.property('actor_id'),
                processor: listenerModel.property('processor'),
                subtask_id: await this.producer.actorManager.getSubtaskGlobalId()//提前占用subtask_id
            }
            listenerContexts.push(context);
        }
        return listenerContexts;
    }
    
    private async createListenerSubtasks(listeners){
        this.subtasks = [];
        for (const listener of listeners) {
            await this.addListenerSubtask(listener)
            await this.incrPendingSubtaskTotal();
        }
    }

    async addListenerSubtask(listener){
       
        let body = {
            subtask_id: listener.subtask_id,
            consumer_id: listener.consumer_id,
            processor: listener.processor,
            data:{},
        }
        let subtask = <LstrSubtask>(await this.producer.subtaskManager.addSubtask(this,SubtaskType.LSTR,body))      

        await subtask.confirm();
        this.subtasks.push(subtask);
    }


    public async loadSubtasks() {
        let subtaskIds = this.subtask_contexts.map((item)=>{
            return item.subtask_id;
        })
        let subtasks:Array<LstrSubtask> = [];
        for(var subtask_id of subtaskIds){
            let subtask:LstrSubtask = <LstrSubtask>(await this.producer.subtaskManager.getByMessage(this,subtask_id));
            subtasks.push(subtask);
        }
        this.subtasks = subtasks;
        return this;
    }
}