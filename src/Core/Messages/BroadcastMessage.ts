import { Message } from "./Message";
import { MessageStatus,MessageType } from "../../Constants/MessageConstants";


export class BroadcastMessage extends Message{
    type = MessageType.BROADCAST;

    async toDoing() {
        await this.setStatus(MessageStatus.DOING).save();
        return this;
    }

    async createMessageModel(topic:string){
        let messageModel = await super.createMessageModel(topic);
        //TODO 创建lstr子任务
        messageModel.property('status',MessageStatus.DOING);//等待最后一个子任务完成时来标记message为done状态
        return messageModel;
    }

    confirm(): Promise<import("./Message").MessageControlResult> {
        throw new Error("Method not implemented.");
    }
    cancel(): Promise<import("./Message").MessageControlResult> {
        throw new Error("Method not implemented.");
    }
    
}