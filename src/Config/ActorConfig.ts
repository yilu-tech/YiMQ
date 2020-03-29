import { ConsumeTopic } from "./ConsumeTopic";

export interface ActorConfig{
    id:string;
    name:string;
    key:string;
    api:string;
    redis:string;
    topic:Array<string>;
    consumeTopics:Map<string,ConsumeTopic>
}
