
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
import { Exclude } from 'class-transformer';
import { CoordinatorProcessResult } from '../Coordinator/Coordinator';
@Exclude()
export class EcSubtask extends ConsumerSubtask{
    public type:SubtaskType = SubtaskType.EC;

    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();//最终一致由于不用try，直接进入准备成功状态
        return this;
    }

    /**
     * confirm 的时候需要传递data
     */
    async toDo():Promise<CoordinatorProcessResult>{
        let callContext = {
            id: this.id,
            message_id: this.message.id,
            producer: this.message.producer.name,
            topic: this.message.full_topic,
            type: this.type,
            processor: this.processor,
            data:this.data
        }
        let {callResult,callBody}= await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);

        return {
            message_id: this.message_id,
            process:'success',
            call_actor_body: callBody,
            actor_result:  callResult
        }
    }

    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel():Promise<CoordinatorProcessResult>{
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        return {
            message_id: this.message_id,
            process:'success'
        }
    }

}