import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';
import { BusinessException } from '../../Exceptions/BusinessException';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { SystemException } from '../../Exceptions/SystemException';
import { MessageStatus } from '../../Constants/MessageConstants';
export class TccSubtask extends Subtask{
    public prepareResult;
    constructor(message:TransactionMessage,subtaskModel){
        super(message,subtaskModel);
        this.prepareResult = subtaskModel.property('prepareResult');
    }
    
    async prepare() {
        let prepareResult;
        try {
            prepareResult = (await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,this.toJson())).data; 
            await this.setPrepareResult(prepareResult)
            .setStatus(SubtaskStatus.PREPARED)
            .save()
            return this;
        } catch (error) {
            await this.setPrepareResult(error.message).save()
            throw new SystemException('Subtask prepare failed.',error.message);//TODO  返回actor的详细错误
        }
        
    } 

    async toDo(){
        let callContext = {
            message_id: this.message.id,
            id: this.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.setStatus(SubtaskStatus.DONE).save();
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.DONE);
        }
        return result.data;
    }
    async toCancel(){
        let callContext = {
            message_id: this.message.id,
            id: this.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        await this.setStatus(SubtaskStatus.CANCELED).save()
        let pendingSubtaskTotal = await this.message.decrPendingSubtaskTotal();
        if(pendingSubtaskTotal == 0){
            await this.message.setStatus(MessageStatus.CANCELED);
        }
        return result.data;
    }

    public setPrepareResult(prepareResult){
        this.prepareResult = prepareResult;
        this.model.property('prepareResult',this.prepareResult);
        return this;
    }


}