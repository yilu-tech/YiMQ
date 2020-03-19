import { IsDefined,ValidateNested,IsNumber, IsIn } from 'class-validator';
import { MessageType } from '../Constants/MessageConstants';
import { SubtaskType } from '../Constants/SubtaskConstants';

export class CreateMessageDto{
    @IsDefined()
    actor:string;
    @IsDefined()
    topic:string;

    @IsDefined()
    @IsIn([MessageType.GENERAL,MessageType.TRANSACTION])
    type:MessageType;

    delay:number;
}



export class AddSubtaskDto{
    @IsDefined()
    actor:string;

    @IsDefined()
    message_id:string;

    @IsDefined()
    @IsIn([SubtaskType.EC,SubtaskType.TCC])
    type:SubtaskType;

    @IsDefined()
    processor:string;

    data:JSON;
}



