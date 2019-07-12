import { Injectable, Inject } from "@nestjs/common";
import { CoordinatorManager } from "../Core/CoordinatorManager";
import { TranscationJob } from "../Core/Job/TranscationJob";
import { TransactionCoordinator } from "src/Core/Coordinator/TransactionCoordinator";
import { TransactionException } from "../Exceptions/TransactionException";
import { TransactionJobItem } from "../Core/Job/TransactionJobItem/TransactionJobItem";

@Injectable()
export class TransactionService{
    constructor( private coordinatorManager:CoordinatorManager){

    }

    async create(coordinatorName,task){
        let coordinator = await this.coordinatorManager.get(coordinatorName);
        let transcationJob:TranscationJob =  await coordinator.create(task);
        return transcationJob;
    }

    async addItem(item): Promise<TransactionJobItem> {
        let coordinator:TransactionCoordinator = this.coordinatorManager.get(item.coordinator)
        if(!coordinator){
          throw new TransactionException('Coordinator does not exist.');
        }
        let transcationJob:TranscationJob =  await coordinator.getJob(item.transaction_id);
        if(!transcationJob){
          throw new TransactionException('Transcation Job does not exist.');
        }
        return await transcationJob.addItem(item)

    }

     /**
   * 提交事物
   */

  async commit(job): Promise<TranscationJob> {
    let coordinator:TransactionCoordinator = await this.coordinatorManager.get(job.coordinator)
    if(!coordinator){
      throw new TransactionException('Coordinator does not exist.');
    }
    let transcationJob:TranscationJob =  await coordinator.getJob(job.id);
    if(!transcationJob){
      throw new TransactionException('Transcation Job does not exist.');
    }
    return await transcationJob.commit();
  }

  /**
   * 回滚事物
   */
  async rollback(job): Promise<TranscationJob> {
    let coordinator:TransactionCoordinator = await this.coordinatorManager.get(job.coordinator)
    if(!coordinator){
      throw new TransactionException('Coordinator does not exist.');
    }
    let transcationJob:TranscationJob =  await coordinator.getJob(job.id);
    if(!transcationJob){
      throw new TransactionException('Transcation Job does not exist.');
    }
    return await transcationJob.rollback();
  }


    
}


