import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';
import { BusinessException } from '../../Exceptions/BusinessException';
import { TransactionMessage } from '../Messages/TransactionMessage';
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
            throw new BusinessException('Subtask prepare failed.',error.message);//TODO  返回actor的详细错误
        }
        
    } 

    public setPrepareResult(prepareResult){
        this.prepareResult = prepareResult;
        this.model.property('prepareResult',this.prepareResult);
        return this;
    }


}