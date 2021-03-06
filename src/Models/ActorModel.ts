
import { NohmModel, TTypedDefinitions } from "nohm";
import { RedisOptions } from "ioredis";


interface ActorProperties {
    id:number
    name: string;
    key: string;
    api: string;
    status: string;
    protocol:string;
    options:string;
    redis:string;
    redisOptions: RedisOptions;
}

export class ActorModelClass extends NohmModel<ActorProperties> {
    public static modelName = 'actor';

    protected static definitions: TTypedDefinitions<ActorProperties> = {
        id: {
            type: 'integer',
            index:true,
            validations: ['notEmpty'],
        },
        name: {
            type: 'string',
            unique: true,
            index:true,
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
            type: 'string',
            index:true,
            validations: ['notEmpty'],
        },
        protocol: {
            type: 'string'
        },
        options: {
            type: 'json',
            defaultValue: {}
        },
        redis: {
            type: 'string'
        },
        redisOptions: {
            type: 'json'
        }
    };
}

