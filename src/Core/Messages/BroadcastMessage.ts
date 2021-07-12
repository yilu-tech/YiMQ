import { Message } from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";
import { LstrSubtask } from "../Subtask/LstrSubtask";
import { SubtaskStatus, SubtaskType } from "../../Constants/SubtaskConstants";
import { CoordinatorProcessResult } from "../Coordinator/Coordinator";
import { MessageOptions } from "../../Structures/MessageOptionsStructure";
import { RedisClient } from "../../Handlers/redis/RedisClient";
import { Exclude } from "class-transformer";
import IORedis from "ioredis";

@Exclude()
export class BroadcastMessage extends Message{
    public type = MessageType.BROADCAST;
    public context:object = {};
    public subtasks:LstrSubtask[] = [];

    async createMessageModel(topic:string,data,options:MessageOptions){
        await super.createMessageModel(topic,data,options);
        // this.model.property('status',MessageStatus.DOING);//等待最后一个子任务完成时来标记message为done状态
        return this;
    }

    async toDoing():Promise<CoordinatorProcessResult> {
        let listener_contexts = await this.getListeners()

        if(listener_contexts.length == 0 ){
            await this.notHaveListenerToDone();
            return {result: 'success',desc:'Not have listeners.'};
        }
        await this.createListenerSubtasks(listener_contexts)
        await this.confirmListenerSubtaks(this.subtasks);
        // await this.setStatus(MessageStatus.DOING).save();
        return {result: 'success',desc:`Broadcast to ${this.subtasks.length} listeners.`};
    }

    async notHaveListenerToDone(){
        await this.loadParentSubtask();

        let multi = this.producer.redisClient.multi();
        await this.setStatusAndUpdate(multi,MessageStatus.DONE)
        if(this.parent_subtask){
            // this.parent_subtask.completeAndSetMeesageStatusByScript(multi,SubtaskStatus.DONE,MessageStatus.DONE);//修改parent_bcst_subtask状态
        }
        let multiResult = await multi.exec();//todo: 判断结果
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
        let redisMulti = this.producer.redisClient.multi();
        this.subtasks = [];
        for (const listener of listeners) {
            //重写nohm后 可以吧 hasListener addSubtask incrPendingSubtaskTotal放在一个事务中
            if(!await this.hasListener(this.producer.redisClient,listener.consumer_id,listener.processor)){
                let subtask = await this.addListenerSubtask(redisMulti,listener)
                this.subtasks.push(subtask);
            }
        }
        await redisMulti.exec(); //todo: 判断结果
    }

    private async hasListener(redisClient:RedisClient,consumer_id,processor){
        let message_has_subtask_ids_tmp_key = `yimq:actor:${this.producer.id}:message:${this.id}:has_subtask_ids`
        let subtask_message_id_index_key = `nohm:index:subtask:message_id:${this.id}`;
        let subtask_consumer_id_index_key = `nohm:index:subtask:consumer_id:${consumer_id}`;
        let subtask_processor_index_key = `nohm:index:subtask:processor:${processor}`;

        return await redisClient['message_has_subtask'](message_has_subtask_ids_tmp_key,subtask_message_id_index_key,subtask_consumer_id_index_key,subtask_processor_index_key)
    }

    async addListenerSubtask(redisMulti:IORedis.Pipeline,listener){
        let body = {
            subtask_id: listener.subtask_id,
            consumer_id: listener.consumer_id,
            processor: listener.processor,
            data:{},
        }
        let subtask = <LstrSubtask>await this.producer.subtaskManager.get(listener.subtask_id);
        if(!subtask){
            // subtask = <LstrSubtask>(await this.producer.subtaskManager.addSubtask(redisMulti,this,SubtaskType.LSTR,body)) 
            // await this.incrPendingSubtaskTotalAndLinkSubtask(redisMulti,subtask);
        }     
        return subtask;
    }
    async confirmListenerSubtaks(subtasks:LstrSubtask[]){
        for (const subtask of subtasks) {
            await subtask.confirm();
        }
    }
}