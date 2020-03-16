import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { Message } from '../Messages/Message';
import { BusinessException } from '../../Exceptions/BusinessException';
export class TccSubtask extends Subtask{
    public prepareResult;
    constructor(message:Message,subtaskModel){
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