import { Get, Controller, Post, Put, Delete, Patch, Body, Param, Inject, UseFilters } from '@nestjs/common';
import { CoordinatorManager } from '../Core/CoordinatorManager';
import { CreateTransactionDto, AddTransactionItemDto } from '../Dto/TransactionDto';
import { TranscationJob } from '../Core/Job/TranscationJob';
import { TransactionCoordinator } from '../Core/Coordinator/TransactionCoordinator';
import { BusinessException } from '../Exceptions/BusinessException';
import {TransactionService} from '../Services/TransactionService';
import { HttpExceptionFilter } from '../ExceptionFilters/HttpExceptionFilter';




@Controller('transactions')
@UseFilters(new HttpExceptionFilter())
export class TransactionController {
  constructor(@Inject('CoordinatorManager') private coordinatorManager:CoordinatorManager,private transactionService:TransactionService) {

  }

  /**
   * 开启事物
   */
  @Post('')
  async begin(@Body() createTransactionDto:CreateTransactionDto): Promise<any> {
    let transactionJob = await this.transactionService.create(createTransactionDto.coordinator,createTransactionDto);
    return transactionJob.toJson();
    
  }

  /**
   * 创建事物任务
   */
  @Post('items')
  async jobs(@Body() body:AddTransactionItemDto): Promise<any> {
    let item = await this.transactionService.addItem(body);
    return item.toJson();
  }



  /**
   * 提交事物
   */
  @Patch('commit')
  async commit(@Body() body): Promise<any> {
    let job =  await this.transactionService.commit(body);
    return job.toJson();
  }

  /**
   * 回滚事物
   */
  @Patch('rollback')
  async rollback(@Body() body): Promise<any> {
    let job =  await this.transactionService.rollback(body);
    return job.toJson();
  }

}
