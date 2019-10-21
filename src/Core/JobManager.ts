import { Actor } from "./Actor";
import { Job } from "./Job/Job";
import { JobType, JobAction } from "../Constants/JobConstants";
import { GeneralJob } from "./Job/GeneralJob";
import { TransactionJob } from "./Job/TransactionJob";
import { TransactionItemJob } from "./Job/TransactionItemJob";
import { BusinessException } from "../Exceptions/BusinessException";
import { Message } from "./Messages/Message";

export class JobManager{
    constructor(private actor:Actor){
    }

    public async add(message:Message,type:JobType,action:JobAction){
        let data = {
            message_id: message.id,
            action: action
        }
        let jobContext = await this.actor.coordinator.add(message.topic,data);
        let job:Job;
        switch (type) {
            case JobType.GENERAL:
                job = new GeneralJob(jobContext);
                break;
            case JobType.TRANSACTION:
                job = new TransactionJob(jobContext);
                break;
            case JobType.TRANSACTION_ITEM:
                job = new TransactionItemJob(jobContext);
                break;
            default:
                throw new BusinessException('JobType is not exists.')
        }        
        return job;
    }
}