import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { MessageStatus } from "../../Constants/MessageConstants";
import { Subtask } from "./BaseSubtask/Subtask";

import { SubtaskType } from '../../Constants/SubtaskConstants';
export class BcstSubtask extends Subtask{
    type = SubtaskType.BCST
    toDo() {
        throw new Error("Method not implemented.");
    }
    toCancel() {
        throw new Error("Method not implemented.");
    }

    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();//最终一致由于不用try，直接进入准备成功状态
        return this;
    }

    async confirm(){
        // await this.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);
    }



    async cancel() {
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
    }

}