import {Subtask} from './Subtask';
import { SubtaskStatus } from '../../Constants/SubtaskConstants';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
import { MessageStatus } from '../../Constants/MessageConstants';
import { EcSubtask } from './EcSubtask';
import { TransactionMessage } from '../Messages/TransactionMessage';
import { BcstSubtask } from './BcstSubtask';

export class LstrSubtask extends EcSubtask{

    constructor(subtask:BcstSubtask,subtaskModel){
        super(subtask.message,subtaskModel);
    }


}