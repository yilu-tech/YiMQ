import * as bull from 'bull';
import { RedisOptions } from 'ioredis';
import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
import { RedisClient } from '../../Handlers/redis/RedisClient';
export abstract class Coordinator{
    public clientRedisClient:RedisClient;
    public subscriberRedisClient:RedisClient;
    public bclientRedisClient:RedisClient;
    
    protected queue:bull.Queue;
    constructor(public actor:Actor){
    }

    public async initQueue(){
        this.clientRedisClient = await this.actor.redisManager.client(`queue_${this.actor.name}_client`,this.actor.redis);
        this.subscriberRedisClient =  await this.actor.redisManager.client(`queue_${this.actor.name}_subscriber`,this.actor.redis);
        this.bclientRedisClient =  await this.actor.redisManager.client(`queue_${this.actor.name}_bclient`,this.actor.redis);

        let queueOptions:bull.QueueOptions = {
            createClient: (type)=>{
                switch (type) {
                    case 'client':
                        return this.clientRedisClient
                    case 'subscriber':
                        return this.subscriberRedisClient;
                    case 'bclient':
                        return this.bclientRedisClient;
                    default:
                        break;
                }
            }
        };
        let defaultLimiter:bull.RateLimiter =  {
            max: 500,
            duration: 1000*5
        };
        queueOptions.limiter = this.actor.options.coordinator_limiter ? this.actor.options.coordinator_limiter : defaultLimiter ;

        this.queue = new bull(String(this.actor.id),queueOptions);
        // this.queue.on('error',(error)=>{
        //     AppLogger.log(`(${this.actor.name}) ${error.message}`,`Coordinator`)
        // })
        // this.queue.on('paused',()=>{
        //     console.log(`-----> ${this.actor.name} queue paused`);
        // })
        // this.queue.on('failed',()=>{
        //     console.log(`-----> ${this.actor.name} queue failed`);
        // })
        // this.queue.on('resumed',()=>{
        //     console.log(`-----> ${this.actor.name} queue resumed`);
        // })
        // this.queue.on('drained',()=>{
        //     console.log(`-----> ${this.actor.name} queue drained`);
        // })
        // this.queue.on('stalled',()=>{
        //     console.log(`-----> ${this.actor.name} queue stalled`);
        // })

    }

    public abstract async processBootstrap();
    public abstract async onCompletedBootstrap();
    public abstract async callActor(producer,action,context?,options?);

    public getQueue():bull.Queue{
        return this.queue;
    }
    public async close(){
        return this.queue.close().then(()=>{
            AppLogger.log(`(${this.actor.name}) queue closed.`,`Coordinator`)
        });
    }

    public async pause(){
        AppLogger.log(`(${this.actor.name}) queue pause.`,`Coordinator`)
        return this.queue.pause();
    }
    public async resume(){
        AppLogger.log(`(${this.actor.name}) queue resume.`,`Coordinator`)
        return this.queue.resume();
    }
    /**
     * 添加任务
     * @param data 
     */
    public async add(name,data:object,jobOptions:bull.JobOptions){
        return this.queue.add(name,data,jobOptions);
    };


    public async getJob(id:bull.JobId):Promise<bull.Job>{
        return this.queue.getJob(id);
    };
}