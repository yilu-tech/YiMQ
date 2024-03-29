import { ConsumeTopic } from "./ConsumeTopic";
import { RateLimiter, BackoffOptions } from "bull";



export interface ActorOptions{
    headers:object;
    clear_keep_total:number;
    clear_interval:number;
    clear_limit:number;
    clear_backoff:number | BackoffOptions;
    coordinator_limiter:RateLimiter;
    job_attempts_total:number;
    job_attempts_delay:number;
    message_check_min_delay:number;
    message_check_not_exist_ignore:boolean;
}

export const actorDefaultOptions:ActorOptions = {
    headers:{},
    clear_keep_total: 20,
    clear_interval:1000*60*60,
    clear_limit:1000,
    clear_backoff:{
        type:'exponential',
        delay: 1000*5
    },
    job_attempts_total: 5,
    job_attempts_delay: 1000 * 8,
    message_check_min_delay: 1000 * 10,
    message_check_not_exist_ignore: false,
    coordinator_limiter:{
        max: 500,
        duration: 1000*5
    }
}
export interface ActorConfig{
    id:string;
    name:string;
    key:string;
    api:string;
    protocol:string;
    options:ActorOptions;
    headers:object;
    redis:string;
    topic:Array<string>;
    consumeTopics:Map<string,ConsumeTopic>
}
