import { Coordinator } from "./Coordinator";
import { QueueJob } from "../job/QueueJob";

export class QueueCoordinator extends Coordinator{
    public async create(data):Promise<QueueJob>{
        return await this.queue.add(data).then((job)=>{
            return new QueueJob(job)
        })
    }

    public async getJob(id){
        return await this.queue.getJob(id).then((job)=>{
            return job ? new QueueJob(job) : null;
        })
    }

    public async processBootstrap(){

    }

}