import {createClient,RedisClient as OriginRedisClient, ClientOpts} from 'redis';
import { promisify } from 'util';



export class RedisClient{
    private client:OriginRedisClient;
    private async:any = {};

    constructor(client:OriginRedisClient){
        this.client = client;

        this.async.set = promisify(this.client.set).bind(this.client);
        this.async.hmset = promisify(this.client.hmset).bind(this.client);
        this.async.hget = promisify(this.client.hget).bind(this.client);
        this.async.hexists = promisify(this.client.hexists).bind(this.client);
        this.async.hgetall = promisify(this.client.hgetall).bind(this.client);
        this.async.flushdb = promisify(this.client.flushdb).bind(this.client);
        this.async.quit = promisify(this.client.quit).bind(this.client);
    }

    public set(key: string, value: string):Promise<any>
    {
        return this.async.set(...arguments);
    }

    public hmset(hash,...params):Promise<any>
    {
        return this.async.hmset(...arguments);
    }
    public hget(key: string, field: string):Promise<any>
    {
        return this.async.hget(...arguments);
    }

    public hexists(key: string, field: string):Promise<any>
    {
        return this.async.hexists(...arguments);
    }
    public hgetall(key: string):Promise<any>
    {
        return this.async.hgetall(...arguments);
    }
    public flushdb():Promise<any>
    {
        return this.async.flushdb(...arguments);
    }
    public quit():Promise<any>
    {
        return this.async.quit(...arguments);
    }











    static create(redisOptions:ClientOpts){
        return new RedisClient(createClient(redisOptions));
    }
}