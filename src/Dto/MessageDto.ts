import { IsDefined,ValidateNested,IsNumber, IsIn, IsInt, IsJSON } from 'class-validator';
import { MessageType } from '../Constants/MessageConstants';
import { SubtaskType } from '../Constants/SubtaskConstants';
import { isNumber } from 'util';

export class CreateMessageDto{
    @IsDefined()
    actor:string;
    @IsDefined()
    topic:string;

    @IsDefined()
    @IsIn([MessageType.GENERAL,MessageType.TRANSACTION,MessageType.BROADCAST])
    type:MessageType;

    @IsInt()
    delay:number;

    parent_subtask:string;

    data:JSON;
}



export class AddSubtaskDto{
    @IsDefined()
    actor:string;

    @IsDefined()
    message_id:string;

    @IsDefined()
    @IsIn([SubtaskType.EC,SubtaskType.TCC,SubtaskType.XA])
    type:SubtaskType;

    @IsDefined()
    processor:string;

    data:JSON;
    options:JSON;
}


export class MessageConfirmDao{
    @IsDefined()
    actor:string;

    @IsDefined()
    message_id:string;
}

export class MessageCancelDao{
    @IsDefined()
    actor:string;

    @IsDefined()
    message_id:string;
}





