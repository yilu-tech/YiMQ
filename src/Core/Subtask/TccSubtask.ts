
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { MessageStatus } from '../../Constants/MessageConstants';
import { ConsumerSubtask } from './BaseSubtask/ConsumerSubtask';
export class TccSubtask extends ConsumerSubtask{
    public prepareResult;
    constructor(message:TransactionMessage,subtaskModel){
        super(message,subtaskModel);
        this.prepareResult = subtaskModel.property('prepareResult');
    }
    
    async prepare() {
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor,
            data: this.data,
        }

        let prepareResult = (await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,callContext)); 
        await this.setPrepareResult(prepareResult)
        .setStatus(SubtaskStatus.PREPARED)
        .save()
        return this;
        
    } 

    async toDo(){
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        return result;
    }
    async toCancel(){
        let callContext = {
            id: this.id,
            type: this.type,
            message_id: this.message.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CANCEL,callContext);
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
        return result;
    }

    public setPrepareResult(prepareResult){
        this.prepareResult = prepareResult;
        this.model.property('prepareResult',this.prepareResult);
        return this;
    }


}