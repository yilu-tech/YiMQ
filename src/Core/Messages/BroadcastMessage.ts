import { Message } from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { LstrSubtask } from "../Subtask/LstrSubtask";
import { SubtaskType } from "../../Constants/SubtaskConstants";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { MessageOptions } from "../../Structures/MessageOptionsStructure";
import { RedisClient } from "../../Handlers/redis/RedisClient";


export class BroadcastMessage extends Message{
    public type = MessageType.BROADCAST;
    public context:object = {};

    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        this.model.property('status',MessageStatus.DOING);//等待最后一个子任务完成时来标记message为done状态
        return this;
    }


    async toDoing():Promise<CoordinatorProcessResult> {
        let subtask_contexts = await this.getListeners()
        await this.createListenerSubtasks(subtask_contexts)
        await this.setStatus(MessageStatus.DOING).save();
        return {result: 'success'};
    }

    private async getListeners(){
        let listenerModels = await this.producer.actorManager.masterModels.ListenerModel.findAndLoad({
            topic: `${this.producer.name}@${this.topic}`
            // topic: `${this.topic}`  //todo: 增加universal_broadcast，多个actor发起相同topic
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
            //重写nohm后 可以吧 hasListener addSubtask incrPendingSubtaskTotal放在一个事务中
            if(!await this.hasListener(this.producer.redisClient,listener.consumer_id,listener.processor)){
                let subtask = await this.addListenerSubtask(listener)
                await this.incrPendingSubtaskTotalAndLinkSubtask(subtask);
            }
        }
    }

    private async hasListener(redisClient:RedisClient,consumer_id,processor){
        let message_has_subtask_ids_tmp_key = `yimq:actor:${this.producer.id}:message:${this.id}:has_subtask_ids`
        let subtask_message_id_index_key = `nohm:index:subtask:message_id:${this.id}`;
        let subtask_consumer_id_index_key = `nohm:index:subtask:consumer_id:${consumer_id}`;
        let subtask_processor_index_key = `nohm:index:subtask:processor:${processor}`;

        return await redisClient['message_has_subtask'](message_has_subtask_ids_tmp_key,subtask_message_id_index_key,subtask_consumer_id_index_key,subtask_processor_index_key)
    }

    async addListenerSubtask(listener){
        let body = {
            subtask_id: listener.subtask_id,
            consumer_id: listener.consumer_id,
            processor: listener.processor,
            data:{},
        }
        let subtask = await this.producer.subtaskManager.get(listener.subtask_id);
        if(!subtask){
            subtask = <LstrSubtask>(await this.producer.subtaskManager.addSubtask(this,SubtaskType.LSTR,body)) 
        }     

        await subtask.confirm();
        this.subtasks.push(subtask);
        return subtask;
    }
}