
import { EcSubtask } from './EcSubtask';
import { BcstSubtask } from './BcstSubtask';
import { MessageStatus } from '../../Constants/MessageConstants';
import { SubtaskType } from '../../Constants/SubtaskConstants';
import { Exclude } from 'class-transformer';

/**
 * Lstr (Listener)
 */
@Exclude()
export class LstrSubtask extends EcSubtask{
    public type:SubtaskType = SubtaskType.LSTR;

    async initProperties(subtaskModel){
        await super.initProperties(subtaskModel);
        this.data = this.message.data;

    }
    public async completeAndSetMeesageStatusByScript(redisClient,status,messageStatus:MessageStatus){
        return redisClient['LstrSubtaskCompleteAndSetMessageStatus'](this.id,this.message.id,'updated_at',status,messageStatus,new Date().getTime());  
    }

}