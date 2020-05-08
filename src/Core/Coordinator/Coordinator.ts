import * as bull from 'bull';
import { RedisOptions } from 'ioredis';
import { Actor } from '../Actor';
import {AppLogger} from '../../Handlers/AppLogger';
export abstract class Coordinator{
    
    protected queue:bull.Queue;
    constructor(public actor:Actor,options:RedisOptions){
        this.queue = new bull(String(this.actor.id),{redis:options});
    }

    public abstract async processBootstrap();
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