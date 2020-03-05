import {Subtask} from './Subtask';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';

export class EcSubtask extends Subtask{
    async prepare() {
        this.status = SubtaskStatus.PREPARING;
        await this.message.update();
        return this;
    }

}