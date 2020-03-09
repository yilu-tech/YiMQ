import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { BusinessException } from '../../Exceptions/BusinessException';
import { Message } from '../Messages/Message';
export class TccSubtask extends Subtask{
    public prepareResult;
    constructor(message:Message,subtaskModel){
        super(message,subtaskModel);
        this.prepareResult = subtaskModel.property('prepareResult');
    }
    async prepare() {

        try {
            this.prepareResult = (await this.consumer.coordinator.callActor(this.message.producer,CoordinatorCallActorAction.TRY,this.toJson())).data; 
            this.status = SubtaskStatus.PREPARED;
            await this.update();
            return this;
        } catch (error) {
            this.prepareResult = error.response;
            await this.update();
            throw new BusinessException(error.message);//TODO  返回actor的详细错误
        }
        
    } 

    public async update(){
        this.model.property('prepareResult',this.prepareResult);
        await super.update();
    }

}