import * as bull from 'bull';
import { RedisOptions } from 'ioredis';
import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
export abstract class Coordinator{
    
    protected queue:bull.Queue;
    constructor(public actor:Actor,options:RedisOptions){
        options = {
            ...options,
            maxRetriesPerRequest:null,//无限重试
            enableReadyCheck: false,//需要设置为false,否则redis重新链接后，process不会继续处理，参考: https://github.com/OptimalBits/bull/issues/890
            retryStrategy(times) {
                const delay = Math.min(times * 100, 5000);
                AppLogger.log(`Coordinator (${actor.name}) redis retryStrategy ${times}.`,`Coordinator`)
                return delay;
            },
            //enableReadyCheck=false 的时候，导致redis还在恢复数据到内存的时候，命令已经发送，导致错误 https://github.com/luin/ioredis/issues/358
            reconnectOnError: function(err) { 
                if (err.message.includes("LOADING")) {
                    return 2;
                }
              }
        }
        let queueOptions:bull.QueueOptions = {
            redis:options
        };
        let defaultLimiter:bull.RateLimiter =  {
            max: 500,
            duration: 1000*5
        };
        queueOptions.limiter = this.actor.options.coordinator_limiter ? this.actor.options.coordinator_limiter : defaultLimiter ;
        this.queue = new bull(String(this.actor.id),queueOptions);
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
        return this.queue.pause();
    }
    public async resume(){
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