import {Subtask} from './Subtask';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';

export class EcSubtask extends Subtask{
    async prepare() {
        this.status = SubtaskStatus.PREPARED;//最终一致由于不用try，直接进入准备成功状态
        await this.message.update();
        return this;
    }

}