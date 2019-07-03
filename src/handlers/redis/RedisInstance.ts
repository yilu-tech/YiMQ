import { Redis,RedisOptions } from 'ioredis'



export class RedisInstance{


    constructor(public client:Redis){
    }
}