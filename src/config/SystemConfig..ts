import { RedisOptions } from "ioredis";

export class SystemConfig{
    readonly redis:RedisOptions;
    constructor(doc){
        this.redis = doc['redis'];
    }
}
