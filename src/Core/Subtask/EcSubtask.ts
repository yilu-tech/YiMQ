
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';

export class EcSubtask extends ConsumerSubtask{
    public type:SubtaskType = SubtaskType.EC;

    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();//最终一致由于不用try，直接进入准备成功状态
        return this;
    }

    /**
     * confirm 的时候需要传递data
     */
    async toDo(){
        let callContext = {
            id: this.id,
            message_id: this.message.id,
            type: this.type,
            processor: this.processor,
            data:this.data
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);

        return result;
    }

    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel(){
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
    }

}