import { Coordinator } from "./Coordinator";

import { TranscationJob } from "../job/TranscationJob";
export class TransactionCoordinator extends Coordinator{

    public async create(data):Promise<TranscationJob>{
        data.items = [];
        var options = {
            delay: data.delay? data.delay : 10000 
        }
        return await this.queue.add(data.name,data,options).then((job)=>{
            return new TranscationJob(job)
        })
    }

    /**
     * 启动处理器
     */
    public async processBootstrap(){

        this.queue.process('*',1000,async (job)=>{
            let transcationJob = new TranscationJob(job);
            return await transcationJob.process();
        })
    }

    public async getJob(id):Promise<TranscationJob>{
        return await this.queue.getJob(id).then((job)=>{
            return job ? new TranscationJob(job) : null;
        })
    }
}