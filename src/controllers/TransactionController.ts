import { Get, Controller, Post, Put, Delete, Patch, Body, Param, Inject } from '@nestjs/common';
import { CoordinatorManager } from '../Core/CoordinatorManager';
import { CreateTransactionDto, AddTransactionItemDto } from '../Dto/TransactionDto';
import { TranscationJob } from '../Core/Job/TranscationJob';
import { TransactionCoordinator } from '../Core/Coordinator/TransactionCoordinator';
import { BusinessException } from '../Exceptions/BusinessException';





@Controller('transactions')
export class TransactionController {
  constructor(@Inject('CoordinatorManager') private coordinatorManager:CoordinatorManager) {

  }

  /**
   * 开启事物
   */
  @Post('')
  async begin(@Body() createTransactionDto:CreateTransactionDto): Promise<any> {

    let coordinator = await this.coordinatorManager.get(createTransactionDto.coordinator);
    let transcationJob:TranscationJob =  await coordinator.create(createTransactionDto);
    return transcationJob.toJson();
  }

  /**
   * 创建事物任务
   */
  @Post('items')
  async jobs(@Body() body:AddTransactionItemDto): Promise<any> {
    let coordinator:TransactionCoordinator = this.coordinatorManager.get(body.coordinator)
    if(!coordinator){
      throw new BusinessException('Coordinator does not exist.');
    }
    let transcationJob:TranscationJob =  await coordinator.getJob(body.transaction_id);
    if(!transcationJob){
      throw new BusinessException('Transcation Job does not exist.');
    }
    let jobItem = await transcationJob.addItem(body)
    return jobItem.toJson();
  }



  /**
   * 提交事物
   */
  @Patch('commit')
  async commit(@Body() body): Promise<any> {
    let coordinator:TransactionCoordinator = await this.coordinatorManager.get(body.coordinator)
    if(!coordinator){
      throw new BusinessException('Coordinator does not exist.');
    }
    let transcationJob:TranscationJob =  await coordinator.getJob(body.id);
    if(!transcationJob){
      throw new BusinessException('Transcation Job does not exist.');
    }
    await transcationJob.commit();
    return transcationJob.toJson();
  }

  /**
   * 回滚事物
   */
  @Patch('rollback')
  async rollback(@Body() body): Promise<any> {
    let coordinator:TransactionCoordinator = await this.coordinatorManager.get(body.coordinator)
    if(!coordinator){
      throw new BusinessException('Coordinator does not exist.');
    }
    let transcationJob:TranscationJob =  await coordinator.getJob(body.id);
    if(!transcationJob){
      throw new BusinessException('Transcation Job does not exist.');
    }
    await transcationJob.rollback();
    return transcationJob.toJson();
  }

}
