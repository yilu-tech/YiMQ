import * as bull from 'bull';
import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
import { RedisClient } from '../../Handlers/redis/RedisClient';
import { BusinessException } from '../../Exceptions/BusinessException';
import { clamp } from 'lodash';
import { Database } from '../../Database';
import {  JobEventType, JobStatus } from '../../Constants/JobConstants';
import { Job } from '../Job/Job';
import { timeout } from '../../Handlers';
import { EventEmitter } from 'events';
import { JobEventListener } from '../../Interfaces/JobInterfaces';

export interface CoordinatorProcessResult{
    action?:string;
    result: 'success' | 'compensate success'
    actor_result?:any;
    desc?:string;
}
/**
 * 如果消息重试16次后仍然失败，消息将不再投递。
 * 如果严格按照上述重试时间间隔计算，某条消息在一直消费失败的前提下，
 * 将会在接下来的4小时46分钟之内进行16次重试，超过这个时间范围消息将不再重试投递。
 */

function standardBackOff(attemptsMade, err){
    let unit_time = process.env.STANDARD_BACKOFF_UNIT_TIME ? Number(process.env.STANDARD_BACKOFF_UNIT_TIME) : 1000;
    let standardBackOffStrategyTimes = {
        1: unit_time * 5, //与上次重试的间隔时间
        2: unit_time * 10,
        3: unit_time * 30,
        4: unit_time * 60,
        5: unit_time * 60*2,
        6: unit_time * 60*3,
        7: unit_time * 60*4,
        8: unit_time * 60*5,
        9: unit_time * 60*6,
        10: unit_time * 60*7,
        11: unit_time * 60*8,
        12: unit_time * 60*9,
        13: unit_time * 60*10,
        14: unit_time * 60*20,
        15: unit_time * 60*30,
        16: unit_time * 60*60,
        17: unit_time * 60*60*2,
    };
    
    if(standardBackOffStrategyTimes[attemptsMade]){
        // console.log('----->',standardBackOffStrategyTimes[attemptsMade])
        return standardBackOffStrategyTimes[attemptsMade];
    }else{
        return -1;
    }
}

export abstract class Coordinator{
    public closing:boolean = false;
    public concurrency:number = 5;


    public clientRedisClient:RedisClient;
    public subscriberRedisClient:RedisClient;
    public bclientRedisClient:RedisClient;
    private retry_local_key:string;
    private database:Database;
    public processPromises:Map<string,Promise<any>> = new Map();
    
    protected queue:bull.Queue;
    public event:EventEmitter = new EventEmitter();
    constructor(public actor:Actor){
        this.retry_local_key = `actor:${this.actor.id}:retry:lock`;
        this.database = this.actor.actorManager.application.database;
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
            },
            settings:{
                backoffStrategies:{
                    standard: standardBackOff
                }
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

    public abstract processBootstrap();
    public abstract callActor(producer,action,context?,options?);

    public getQueue():bull.Queue{
        return this.queue;
    }
    public async close(){
        // await this.queue.close();
        // await this.queue.removeAllListeners();
        if(this.closing){
            return;
        }
        this.closing = true;
        return Promise.all(this.processPromises.values());
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

    public async run(){
        if(this.closing){
            return;
        }

        while(!this.closing){

            if(this.processPromises.size >= this.concurrency){
                console.log('超过并发，等待...')
                await timeout(50);
                continue;
            }

            let job = await this.getNextJob();

            if(!job){
                // console.log('没有job了，等待下次...')
                await timeout(100);
                continue;
            }
            this.processJob(job);
            

        }
        return this.processPromises;
    }

    public processJob(job:Job){
        
        
        let promise = job.process().then(async (result)=>{
            this.event.emit(JobEventType.COMPLETED,job,result);
            await job.moveToCompleted();

        }).catch(async (error)=>{
            this.event.emit(JobEventType.FAILED,job,error);
            await job.moveToFailed();

        }).finally(()=>{
            this.processPromises.delete(job.id.toHexString());
        })

        this.processPromises.set(job.id.toHexString(),promise)

        return promise
        
    }

    public pop(){

    }

    public async getNextJob(){

        let nextJobModel = await this.database.JobModel.findOneAndUpdate({
            actor_id:this.actor.id,
            status:JobStatus.WAITING,
            available_at:{$lte:new Date()}
        },{
            $set:{
                status: JobStatus.ACTIVE,
                reserved_at: new Date()
            }
        },{new:true})

        if(!nextJobModel){
            return null;
        }
        return await this.actor.jobManager.restoreByModel(nextJobModel);
    }

    public async on(eventType:JobEventType,listener:JobEventListener){
        this.event.on(eventType,listener);
    }
}

/**
 * 
 * reserved_at
 * 处理的时候每5秒更新一次finished_at,
 * 如果5秒后检测，current_time - finished_at > 6, 取消远程请求，取消定时 ，抛出错误
 * 
 * 
 * 如果avalibel状态，current_time - finished_at > 10 ，把任务移动到delay任务中
 * 
 */