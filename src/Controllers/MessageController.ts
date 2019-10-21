import { Controller, Post, Patch, Body, Inject, UseFilters } from '@nestjs/common';
import { HttpExceptionFilter } from '../ExceptionFilters/HttpExceptionFilter';
import { CreateTransactionMessageDto } from '../Dto/TransactionDto';
import { AddTransactionItemDto } from '../Dto/TransactionDto';
import { MessageService } from '../Services/MessageService';
import { MessageType } from '../Constants/MessageConstants';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';




@Controller('message')
@UseFilters(new HttpExceptionFilter())
export class MessagesController {
    constructor(private messageService:MessageService){

    }

    @Post('general.create')
    async create(): Promise<any> {


    }

    /**
     * 开启事物
     */
    @Post('transaction.begin')
    async begin(@Body() createTransactionMessageDto: CreateTransactionMessageDto): Promise<any> {
        // let transactionMessage:TransactionMessage = await this.messageManager.create<TransactionMessage>(createTransactionMessageDto.actor, MessageType.TRANSACTION, createTransactionMessageDto.topic);
        // return transactionMessage.toJson();
        let transactionMessage = await this.messageService.create<TransactionMessage>(createTransactionMessageDto.actor, MessageType.TRANSACTION, createTransactionMessageDto.topic);
        return transactionMessage.toJson();
    }

    /**
     * 创建事物任务
     */
    @Post('transaction.item')
    async jobs(@Body() body: AddTransactionItemDto): Promise<any> {

    }



    /**
     * 提交事物
     */
    @Patch('transaction.commit')
    async commit(@Body() body): Promise<any> {

    }

    /**
     * 回滚事物
     */
    @Patch('transaction.rollback')
    async rollback(@Body() body): Promise<any> {

    }

}
