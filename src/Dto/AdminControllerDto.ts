import { IsDefined, Validate  } from "class-validator";
import { JobStatus } from "../Constants/JobConstants";
import { StringArrayIsIn } from "./CustromValidators";


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
    @Validate(StringArrayIsIn,[JobStatus.ACTIVE,JobStatus.COMPLETED,JobStatus.DELAYED,JobStatus.FAILED,JobStatus.PAUSED,JobStatus.WAITING])
    types:string[];
    @IsDefined()
    start:number;
    @IsDefined()
    end:number;
    @IsDefined()
    asc:boolean;
}


export class ActorJobDto{
    @IsDefined()
    actor_id:number;
    @IsDefined()
    job_id:number;
}

export class ActorJobRetryDto{
    @IsDefined()
    actor_id:number;
    @IsDefined()
    job_ids:string|number[];
}



export class ActorDao{
    @IsDefined()
    actor_id:number;
}