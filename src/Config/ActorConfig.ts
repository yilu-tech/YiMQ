import { ConsumeTopic } from "./ConsumeTopic";
import { RateLimiter, BackoffOptions } from "bull";



export interface ActorOptions{
    headers:object;
    clear_interval:number;
    clear_limit:number;
    clear_backoff:number | BackoffOptions;
    subtask_force_attempts:number;
    coordinator_limiter:RateLimiter;
}

export const actorDefaultOptions:ActorOptions = {
    headers:{},
    clear_interval:5000,
    clear_limit:1000,
    clear_backoff:{
        type:'exponential',
        delay: 1000*5
    },
    subtask_force_attempts: 3,
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
