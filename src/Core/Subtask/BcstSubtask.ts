import { EcSubtask } from "./EcSubtask";
import { SubtaskStatus } from "../../Constants/SubtaskConstants";
import { MessageStatus } from "../../Constants/MessageConstants";
import { Subtask } from "./Subtask";
import { TransactionMessage } from "../Messages/TransactionMessage";

export class BcstSubtask extends Subtask{
    public topic:string;

    constructor(message:TransactionMessage,subtaskModel){
        super(message,subtaskModel);
        this.topic = subtaskModel.property('topic');
    }


    async prepare() {
        await this.setStatus(SubtaskStatus.PREPARED).save();//最终一致由于不用try，直接进入准备成功状态
        return this;
    }

    /**
     * confirm 的时候需要传递data
     */
    async toDo(){
        //TODO
        //1。创建listener job
        
        //2. 设置subtask状态为doing, 设置message状态为done, bcst在所有listener任务完成后再设置为done
        await this.completeAndSetMeesageStatus(SubtaskStatus.DOING,MessageStatus.DONE);

        return null;

    }
    /**
     * ec subtask取消的时候只标记状态
     */
    async toCancel(){
        await this.completeAndSetMeesageStatus(SubtaskStatus.CANCELED,MessageStatus.CANCELED);
    }
}