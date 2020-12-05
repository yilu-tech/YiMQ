import * as bull from 'bull';
import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
import { RedisClient } from '../../Handlers/redis/RedisClient';
import { Job } from '../Job/Job';
import { BusinessException } from '../../Exceptions/BusinessException';
import { clamp } from 'lodash';

export interface CoordinatorProcessResult{
    action?:string;
    result: 'success' | 'compensate success'
    actor_result?:any;
    desc?:string;
}

export abstract class Coordinator{
    public clientRedisClient:RedisClient;
    public subscriberRedisClient:RedisClient;
    public bclientRedisClient:RedisClient;
    private retry_local_key:string;
    
    protected queue:bull.Queue;
    constructor(public actor:Actor){
        this.retry_local_key = `actor:${this.actor.id}:retry:lock`;
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
            },
            defaultJobOptions:{
                stackTraceLimit:3
            }
        };
        let defaultLimiter:bull.RateLimiter =  {
            max: 500,
            duration: 1000*5
        };
        queueOptions.limiter = this.actor.options.coordinator_limiter ? this.actor.options.coordinator_limiter : defaultLimiter ;

        this.queue = new bull(String(this.actor.id),queueOptions);
        //不能启用一下事件，否在在shutdown的时候，虽然会等待job执行完毕，但不会等待以下事件执行完毕，会造成不一致或者redis抛出断开连接的错误
        // this.queue.on('completed',(job,result)=>{
        // })
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
    public abstract async callActor(producer,action,context?,options?);

    public getQueue():bull.Queue{
        return this.queue;
    }
    public async close(){
        await this.queue.close();
        await this.queue.removeAllListeners();
        AppLogger.log(`Coordinator closed...... (${this.actor.name}) `,`Coordinator`)
    }

    public async pause(){
        AppLogger.log(`Coordinator pause...... (${this.actor.name}) `,`Coordinator`)
        return this.queue.pause();
    }
    public async resume(){
        AppLogger.log(`Coordinator resume...... (${this.actor.name}) `,`Coordinator`)
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

    public async getJobConuts(){
        return this.queue.getJobCounts();
    }

    public async getJobs(types:any[], start?: number, end?: number, asc?: boolean){
        let  jobContexts = await this.queue.getJobs(types,start,end,asc);
        let jobs = [];
        let abnormal_jobs = []
        for (const jobContext of jobContexts) {
            try {
                let job = await this.actor.jobManager.restoreByContext(jobContext);
                jobs.push(job);   
            } catch (error) {
                let jobJson = jobContext.toJSON();
                jobJson['error_message'] = error.message;
                abnormal_jobs.push(jobJson);
            }
        }
        return [jobs,abnormal_jobs];
    }

    public async retry(job_ids:number[]|string){
        let jobs:bull.Job[] = [];
        if(job_ids == '*'){
            let failedCount = await this.queue.getFailedCount();
            let lockTime = clamp(failedCount * 0.05,10,60)
            let getLock = await this.actor.redisClient.set(this.retry_local_key,1,"EX",lockTime,'NX')
            if(!getLock){
                let lockWatingTime = await this.actor.redisClient.ttl(this.retry_local_key);
                throw new BusinessException(`Please try again in ${lockWatingTime} seconds.`);
            }
            
            jobs = await this.queue.getFailed(0,5000)
        }else{
            for (const job_id of job_ids) {
                let job = await this.queue.getJob(job_id);
                if(!job){
                    throw new BusinessException(`Job ${job_id} of actor ${this.actor.id} not exists.`);
                }
                jobs.push(job)
            }
        }

        for (const job of jobs) {
            await job.retry()
        }
        return {
            total: jobs.length
        }
    }
}