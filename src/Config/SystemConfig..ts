import { RedisOptions } from "ioredis";

export class SystemConfig{
    mongodbUri:string;
    connectionPrefix:string;
    readonly port:number;
    readonly adminApi: string;
    readonly default:string;
    readonly redis:Array<RedisOptions>;
    constructor(doc){
        this.port =  doc['port'] || 7379;
        this.adminApi = `http://127.0.0.1:${this.port}`;
        this.default = doc['default'];
        this.redis = doc['redis'];
        this.mongodbUri = doc['mongodb_uri'];
        this.connectionPrefix = '';
    }
}
