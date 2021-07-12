
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
import { Exclude } from 'class-transformer';
import { CoordinatorProcessResult } from '../Coordinator/Coordinator';
import { TransactionCallback } from '../../Handlers';
import { JobType } from '../../Constants/JobConstants';
import { SubtaskJob } from '../Job/SubtaskJob';
import { JobOptions } from '../../Interfaces/JobOptions';
import { ClientSession } from 'mongoose';
@Exclude()
export class EcSubtask extends ConsumerSubtask{

    public type:SubtaskType = SubtaskType.EC;

    public async createModel(body){
        await super.createModel(body);
        this.model.status = SubtaskStatus.PREPARED;   
    }




    /**
     * confirm 的时候需要传递data
     */
    async toDo():Promise<CoordinatorProcessResult>{
        let actor_result = await this.toDoRemote()
        await this.completeAndCompleteMessage(SubtaskStatus.DOING,SubtaskStatus.DONE,MessageStatus.DOING,MessageStatus.DONE);
        return {
            result:'success',
            actor_result
        }
    }

    public async toDoRemote(){
        let callContext = {
            id: this.id,
            message_id: this.message.id,
            producer: this.message.producer.name,
            topic: this.message.full_topic,
            type: this.type,
            processor: this.processor,
            data:this.data
        }
        let actor_result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);
        return actor_result;
    }

    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel():Promise<CoordinatorProcessResult>{
        // await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        await this.completeAndCompleteMessage(SubtaskStatus.CANCELLING,SubtaskStatus.CANCELED,MessageStatus.CANCELLING,MessageStatus.CANCELED);
        return {result:'success'}
    }

}