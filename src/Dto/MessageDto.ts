import { IsDefined,ValidateNested,IsNumber, IsIn, IsInt } from 'class-validator';
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
}



