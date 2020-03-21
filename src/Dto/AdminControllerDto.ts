import { IsDefined, IsInt,  } from "class-validator";


export class MessagesDto{
    @IsDefined()
    actor_id:number;
    message_id:number;
    topic:string;
}

export class MessageDetailDto{
    @IsDefined()
    actor_id:number;
    @IsDefined()
    message_id:number;
}