import * as bull from 'bull';
import { RedisOptions } from 'ioredis';

export class Coordinator{
    
    protected queue:bull.Queue;
    constructor(name:string,options:RedisOptions){
        this.queue = new bull(name,{redis:options});
    }
    public getQueue():bull.Queue{
        return this.queue;
    }
    public async close(){
        return this.queue.close();
    }

    public processBootstrap(){

    };
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
    public async add(name,data:object){
        return this.queue.add(name,data);
    };


    public async getJob(id:bull.JobId):Promise<any>{

    };
}