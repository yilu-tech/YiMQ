import { ConsumeTopic } from "./ConsumeTopic";

export interface ActorOptions{
    headers:object;
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
