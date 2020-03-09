import { Job } from "./Job";
import { ActorMessageStatus, MessageStatus } from "../../Constants/MessageConstants";
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { TransactionMessage } from "../Messages/TransactionMessage";
import { JobType } from "../../Constants/JobConstants";
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { TransactionSubtaskJob } from "./TransactionSubtaskJob";
import * as bull from 'bull';
export class TransactionMessageJob extends Job{
    public message_id:number | string;
    public message:TransactionMessage;
    constructor(message:TransactionMessage,public readonly context:bull.Job){
        super(context)
        this.message_id = message.id;
        this.message = message;
    }
    async process() {
        switch (this.message.status) {
            case MessageStatus.DOING:
                await this.toDo();
                break;
            case MessageStatus.CANCELLING:
                await this.toCancel()
                break;
            case MessageStatus.PENDING:
                await this.remoteCheck();
                break;
            default:
                throw new Error('MessageStatus is not exists.');
        }

    
    }

    private async remoteCheck(){

        let context = {
            message_id: this.message_id
        }
        let result = await this.message.producer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.MESSAGE_CHECK,context);
        switch (result.data.status) {
            case ActorMessageStatus.CANCELED:
                await this.message.statusToCancelling();
                await this.toCancel();
                break;
            case ActorMessageStatus.DONE:
                await this.message.statusToDoing();
                await this.toDo();
                break;
            case ActorMessageStatus.PENDING:
                throw new Error('ActorMessageStatus is PENDING');
            default:
                throw new Error('ActorMessageStatus is not exists.');
        }
    }

    private async toDo(){
        // for (const subtask of this.message.subtasks) {
        //     await subtask.statusToDoing();
        // }
        //并行执行
        //TODO 增加防重复执行，导致重复给subtask添加任务
        return Promise.all(this.message.subtasks.map((subtask)=>{
            return subtask.statusToDoing();
        }))

    }
    private async toCancel(){
        //TODO 创建子任务

    }


}