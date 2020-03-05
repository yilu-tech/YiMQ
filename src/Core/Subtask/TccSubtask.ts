import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { BusinessException } from '../../Exceptions/BusinessException';
import { Message } from '../Messages/Message';
export class TccSubtask extends Subtask{
    public prepareResult;
    constructor(message:Message,type:SubtaskType,subtaskJson){
        super(message,type,subtaskJson);
        this.prepareResult = subtaskJson.prepareResult;
    }
    async prepare() {
        this.status = SubtaskStatus.PREPARING;
        await this.message.update();
        try {
            this.prepareResult = (await this.actor.coordinator.callActor(CoordinatorCallActorAction.TRY,this.toJson())).data; 
            this.status = SubtaskStatus.PREPARED;
            await this.message.update();
            return this.toJson();
        } catch (error) {
            this.prepareResult = error.response;
            await this.message.update();
            throw new BusinessException(error.message);//TODO  返回actor的详细错误
        }
        return this;
        
    } 

}