import { ConsumeTopic } from "./ConsumeTopic";

export interface ActorConfig{
    id:string;
    name:string;
    key:string;
    api:string;
    protocol:string;
    headers:object;
    redis:string;
    topic:Array<string>;
    consumeTopics:Map<string,ConsumeTopic>
}
