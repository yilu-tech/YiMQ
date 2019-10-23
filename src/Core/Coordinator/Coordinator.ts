import * as bull from 'bull';
import { RedisOptions } from 'ioredis';
import { Actor } from '../Actor';

export abstract class Coordinator{
    
    protected queue:bull.Queue;
    constructor(protected actor:Actor,options:RedisOptions){
        this.queue = new bull(this.actor.name,{redis:options});
    }
    public getQueue():bull.Queue{
        return this.queue;
    }
    public async close(){
        return this.queue.close();
    }

    public abstract processBootstrap();
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


    public async getJob(id:bull.JobId):Promise<any>{

    };
}