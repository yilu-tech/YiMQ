
import { NohmModel, TTypedDefinitions } from "nohm";
import { RedisOptions } from "ioredis";


export class BroadcastTopicRegister{
    
}

interface ActorProperties {
    id:number
    name: string;
    key: number;
    api: string;
    status: number;
    protocol:string;
    redis:string;
    redisOptions: RedisOptions;
    broadcastTopics: Array<string>;
    broadcastTopicRegisters:Array<BroadcastTopicRegister>
}

export class ActorModelClass extends NohmModel<ActorProperties> {
    public static modelName = 'Actor';

    protected static definitions: TTypedDefinitions<ActorProperties> = {
        id: {
            type: 'integer',
            index:true,
            validations: ['notEmpty'],
        },
        name: {
            type: 'string',
            unique: true,
            validations: ['notEmpty'],
        },
        key: {
            type: 'string',
            validations: ['notEmpty'],
        },
        api: {
            type: 'string',
            validations: ['notEmpty'],
        },
        status: {
            type: 'integer'
        },
        protocol: {
            type: 'string'
        },
        redis: {
            type: 'string'
        },
        redisOptions: {
            type: 'json'
        },
        broadcastTopics: {
            type: 'json'
        },
        broadcastTopicRegisters: {
            type: 'json'
        }
    };
}

