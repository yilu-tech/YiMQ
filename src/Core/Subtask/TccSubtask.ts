import {Subtask} from './Subtask';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';

export class TccSubtask extends Subtask{
    async prepare() {
        this.status = SubtaskStatus.PREPARING;
        await this.message.update();
        let json = this.toJson();
        try {
            this.status = SubtaskStatus.PREPARED;
            json['result'] = await this.actor.coordinator.callActor(CoordinatorCallActorAction.TRY,this.toJson()); 
        } catch (error) {
                //TODO 
                //1. 记录错误到subtask
                //2。 throw
        }
        
        
        await this.message.update();
        return json;
    } 

}