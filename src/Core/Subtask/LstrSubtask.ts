
import { EcSubtask } from './EcSubtask';
import { BcstSubtask } from './BcstSubtask';

export class LstrSubtask extends EcSubtask{

    constructor(subtask:BcstSubtask,subtaskModel){
        super(subtask.message,subtaskModel);
    }


}