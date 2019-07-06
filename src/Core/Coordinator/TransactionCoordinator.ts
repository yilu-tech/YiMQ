import { Coordinator } from "./Coordinator";

import { TranscationJob } from "../Job/TranscationJob";
import { TransactionJobStatus } from "../Job/Constants/TransactionJobStatus";
export class TransactionCoordinator extends Coordinator{

    public async create(data):Promise<TranscationJob>{
        data.items = [];
        data.status = TransactionJobStatus.PREPARING;//初始化任务状态
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