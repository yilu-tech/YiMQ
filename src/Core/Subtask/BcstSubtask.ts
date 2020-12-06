import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { MessageStatus, MessageType } from "../../Constants/MessageConstants";
import { Subtask } from "./BaseSubtask/Subtask";

import { SubtaskType } from '../../Constants/SubtaskConstants';
import { BroadcastMessage } from "../Messages/BroadcastMessage";

export interface BcstSubtaskContext{
    topic:string;
    message_id?:number;
}

export class BcstSubtask extends Subtask{
    public type = SubtaskType.BCST;
    public context:BcstSubtaskContext = null;
    public broadcastMessage:BroadcastMessage;



    async createSubtaskModel(body){
        this.context = {
            'topic' : body.topic
        }
        let subtaskModel =  await super.createSubtaskModel(body);
        subtaskModel.property('context',this.context);
        return subtaskModel;
    }
    public async restore(subtaskModel){
        await super.restore(subtaskModel);
        this.context = subtaskModel.property('context');
    }
    public async loadBroadcastMessage():Promise<BcstSubtask>{
        this.broadcastMessage = await this.message.producer.messageManager.get(this.context.message_id);
        return this;
    }


    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();
        return this;
    }

    async confirm(){
        // this.broadcastMessage = await this.message.producer.messageManager.create(MessageType.BROADCAST,this.context.topic);
        this.broadcastMessage = new BroadcastMessage(this.message.producer);
        await this.broadcastMessage.createMessageModel(this.context.topic,this.data,{});
        await this.broadcastMessage.setContext({bcst_subtask_id: this.id})
        await this.broadcastMessage.create(this.context.topic,{
            delay:1000//bcst创建的广告信息，考虑不延迟
        });//创建job

        this.context.message_id = Number(this.broadcastMessage.id);
        await this.setProperty('context',this.context).setStatus(SubtaskStatus.DOING).save();
    }
    async cancel() {
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
    }

    toDo() {
        throw new Error("Method not implemented.");
    }
    toCancel() {
        throw new Error("Method not implemented.");
    }

}