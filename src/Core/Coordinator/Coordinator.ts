import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
import { RedisClient } from '../../Handlers/redis/RedisClient';
import { Job } from '../Job/Job';
import { BusinessException } from '../../Exceptions/BusinessException';
import { clamp } from 'lodash';
import { JobsOptions, Queue , Job as BullJob ,Worker, QueueScheduler, QueueOptions, RateLimiterOptions, WorkerOptions, QueueSchedulerOptions} from 'bullmq';
import { JobStatus } from '../../Constants/JobConstants';
import { Logger } from '@nestjs/common';
export abstract class Coordinator{
    public queueRedisClient:RedisClient;
    public workerRedisClient:RedisClient;
    public schedulerRedisClient:RedisClient;
    private retry_local_key:string;
    public worker:Worker;
    public scheduler:QueueScheduler;
    
    protected queue:Queue;
    constructor(public actor:Actor){
        this.retry_local_key = `actor:${this.actor.id}:retry:lock`;
    }

    public async initQueue(){
        this.queueRedisClient = await this.actor.redisManager.client(`queue_${this.actor.name}_client`,this.actor.redis);
        this.workerRedisClient =  await this.actor.redisManager.client(`queue_${this.actor.name}_worker`,this.actor.redis);
        // this.schedulerRedisClient =  await this.actor.redisManager.client(`queue_${this.actor.name}_scheduler`,this.actor.redis);

        // let queueOptions:bull.QueueOptions = {
        //     createClient: (type)=>{
        //         switch (type) {
        //             case 'client':
        //                 return this.clientRedisClient
        //             case 'subscriber':
        //                 return this.subscriberRedisClient;
        //             case 'bclient':
        //                 return this.bclientRedisClient;
        //             default:
        //                 break;
        //         }
        //     },
        //     defaultJobOptions:{
        //         stackTraceLimit:3
        //     }
        // };
        // let defaultLimiter:bull.RateLimiter =  {
        //     max: 500,
        //     duration: 1000*5
        // };
        // queueOptions.limiter = this.actor.options.coordinator_limiter ? this.actor.options.coordinator_limiter : defaultLimiter ;
        // this.queue = new bull(String(this.actor.id),queueOptions);

        let queueOptions:QueueOptions = {
            connection: this.queueRedisClient,
            defaultJobOptions:{
                stackTraceLimit:3
            }
        }
        
        this.queue =  new Queue(String(this.actor.id),queueOptions);
        this.queue.on('error',(error)=>{
            Logger.error(`${this.actor.name} queue redis ${error.message}`,null,'HttpCoordinator')
        })

    }

    public abstract async processBootstrap();
    public async process(fun){

        let workerOptions:WorkerOptions = {
            // prefix: this.actor.redis_prefix,
            connection:this.workerRedisClient
            // connection: this.actor.redisManager.getClientOptions(`queue_${this.actor.name}_worker`,this.actor.redis)
        }

          let defaultLimiter:RateLimiterOptions =  {
            max: 500,
            duration: 1000*5
        };
        workerOptions.limiter = this.actor.options.coordinator_limiter ? this.actor.options.coordinator_limiter : defaultLimiter ;


        this.worker = new Worker(String(this.actor.id),fun,workerOptions);
        this.worker.on('error',(error)=>{
            Logger.error(`${this.actor.name} worker redis ${error.message}`,null,'HttpCoordinator')
        })
        

        let queueSchedulerOptions:QueueSchedulerOptions = {
            // prefix: this.actor.redis_prefix,
            // connection:this.schedulerRedisClient
            connection: this.actor.redisManager.getClientOptions(`queue_${this.actor.name}_scheduler`,this.actor.redis)
        }
        this.scheduler = new QueueScheduler(String(this.actor.id),queueSchedulerOptions);
        this.scheduler.on('error',(error)=>{
            Logger.error(`${this.actor.name} scheduler redis ${error.message}`,null,'HttpCoordinator')
        })
        AppLogger.log(`Coordinator <${this.actor.name}> bootstrap`,`HttpCoordinator`)
    }

    public abstract async callActor(producer,action,context?,options?);

    public getQueue():Queue{
        return this.queue;
    }
    public on(event,fun){
        this.worker.on(event,fun);
    }
    public async close(){
        if(this.worker){
            this.worker.removeAllListeners();
            await this.worker.close();
        }
        this.scheduler && await this.scheduler.close()
        this.queue && this.queue.close();
        // await this.queue.removeAllListeners();
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
    public async add(name,data:object,jobOptions:JobsOptions){
        return this.queue.add(name,data,jobOptions);
    };


    public async getJob(id:string):Promise<BullJob>{
        return this.queue.getJob(id);
    };

    public async getJobConuts(){
        return this.queue.getJobCounts(JobStatus.ACTIVE,JobStatus.COMPLETED,JobStatus.DELAYED,JobStatus.FAILED,JobStatus.PAUSED,JobStatus.WAITING);
    }

    public async getJobCountByTypes(...types){
        return this.queue.getJobCountByTypes.apply(this.queue,types);
    }

    public async getJobs(types:[], start?: number, end?: number, asc?: boolean):Promise<Job[]>{
        let  jobContexts = await this.queue.getJobs(types,start,end,asc);
        let jobs = [];
        for (const jobContext of jobContexts) {
            let job = await this.actor.jobManager.restoreByContext(jobContext);
            jobs.push(job);
        }
        return jobs;
    }

    public async retry(job_ids:string[]|string){
        let jobs:BullJob[] = [];
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