import { Transform } from "class-transformer";
import { IsDefined, IsIn, Validate  } from "class-validator";
import { JobStatus } from "../Constants/JobConstants";
import { MessageStatus } from "../Constants/MessageConstants";
import { StringArrayIsIn } from "./CustromValidators";



export function isFullMessagesSearch(properties:MessagesDto){
    let exists =  ['message_id','topic','subtask_id','job_id','status'].find((property)=>{
        if(properties[property]){
            return true;
        }
    })
    return exists? false: true;
}
export class MessagesDto{
    @IsDefined()
    actor_id:number;

    message_id:number;
    topic:string;
    subtask_id:number;
    job_id:number;

    @Validate(StringArrayIsIn,[MessageStatus.CANCELED,MessageStatus.CANCELLING,MessageStatus.DOING,MessageStatus.DONE,MessageStatus.PENDING])
    status:MessageStatus[];


    @IsDefined()
    start:number;


    @IsDefined()
    size:number;


    @IsDefined()
    @IsIn(['ASC','DESC'])
    @Transform((value:String) => value.toLocaleUpperCase())
    sort:'ASC' | 'DESC';
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
    status:JobStatus[];

    
    @IsDefined()
    @Transform(value => Number(value))
    start:number;


    @IsDefined()
    @Transform(value => Number(value))
    size:number;


    @IsDefined()
    @IsIn(['ASC','DESC'])
    @Transform((value:String) => value.toLocaleUpperCase())
    sort:'ASC' | 'DESC';
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