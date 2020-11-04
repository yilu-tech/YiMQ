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


export class ClearFailedRetry{
    @IsDefined()
    actor_id:number;
}
export class MessageClearFailedRetry{
    @IsDefined()
    actor_id:number;

    message_ids:[number];
    process_ids:[number]
}

export class ActorJobsDao{
    @IsDefined()
    actor_id:number;
    @IsDefined()
    types:[];
    @IsDefined()
    start:number;
    @IsDefined()
    end:number;
    @IsDefined()
    asc:boolean;
}

export class ActorDao{
    @IsDefined()
    actor_id:number;
}