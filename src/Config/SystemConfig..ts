import { RedisOptions } from "ioredis";

export class SystemConfig{
    readonly default:string;
    readonly redis:Array<RedisOptions>;
    constructor(doc){
        this.default = doc['default']
        this.redis = doc['redis'];
    }
}
