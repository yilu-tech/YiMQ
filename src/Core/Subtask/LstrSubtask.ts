
import { EcSubtask } from './EcSubtask';
import { BcstSubtask } from './BcstSubtask';
import { MessageStatus } from '../../Constants/MessageConstants';
import { SubtaskType } from '../../Constants/SubtaskConstants';

export class LstrSubtask extends EcSubtask{
    public type:SubtaskType = SubtaskType.LSTR;
    public async completeAndSetMeesageStatusByScript(status,messageStatus:MessageStatus){
        return this.message.producer.redisClient['LstrSubtaskCompleteAndSetMessageStatus'](this.id,this.message.id,'updated_at',status,messageStatus,new Date().getTime());  
    }

}