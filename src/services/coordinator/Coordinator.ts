import * as bull from 'bull';
import { CoordinatorManager } from '../CoordinatorManager';
import { CoordinatorOptions } from './CoordinatorOptions';
import { Job } from '../job/Job';
export abstract class Coordinator{
    
    protected queue:bull.Queue;
    constructor(private manager:CoordinatorManager,options:CoordinatorOptions){
        this.queue = new bull(options.name,this.manager.config.system.redis);
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
    public abstract async create(data:object);


    public abstract async getJob(id:bull.JobId):Promise<any>;
}