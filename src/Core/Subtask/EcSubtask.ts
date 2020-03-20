import {Subtask} from './Subtask';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { MessageStatus } from '../../Constants/MessageConstants';

export class EcSubtask extends Subtask{
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

        await this.setStatus(SubtaskStatus.DONE).save();
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.DONE);
        }
        return result.data;
    }

    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel(){
        await this.setStatus(SubtaskStatus.CANCELED).save()
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.CANCELED);
        }
        return null;
    }

}