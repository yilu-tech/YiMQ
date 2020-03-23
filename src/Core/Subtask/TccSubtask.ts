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
            prepareResult = (await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,this.toJson())); 
            await this.setPrepareResult(prepareResult)
            .setStatus(SubtaskStatus.PREPARED)
            .save()
            return this;
        } catch (error) {
            let prepareResult = {
                message: error.message,
                data: error.data

            }
            await this.setPrepareResult(JSON.stringify(prepareResult)).save()
            throw new SystemException(error.message,error.data);
        }
        
    } 

    async toDo(){
        let callContext = {
            message_id: this.message.id,
            id: this.id,
            processor: this.processor
        }
        let result = await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.CONFIRM,callContext);

        await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
        return result;
    }
    async toCancel(){
        let callContext = {
            message_id: this.message.id,
            id: this.id,
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