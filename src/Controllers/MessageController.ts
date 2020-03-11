import { Controller, Post, Patch, Body, Inject, UseFilters } from '@nestjs/common';
import { HttpExceptionFilter } from '../ExceptionFilters/HttpExceptionFilter';
import { CreateMessageDto, AddSubtaskDto } from '../Dto/TransactionDto';

import { MessageService } from '../Services/MessageService';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';




@Controller('message')
@UseFilters(new HttpExceptionFilter())
export class MessagesController {
    constructor(private messageService:MessageService){

    }

    /**
     * 开启事物
     */
    @Post('create')
    async begin(@Body() createMessageDto: CreateMessageDto): Promise<any> {
        let message = await this.messageService.create<TransactionMessage>(createMessageDto.actor, createMessageDto.type, createMessageDto.topic,{
            delay: createMessageDto.delay
        });
        return message.toJson();
    }

    /**
     * 创建事物任务
     */
    @Post('subtask')
    async jobs(@Body() addSubtaskDto: AddSubtaskDto): Promise<any> {
        let subtask = await this.messageService.addSubtask(
            addSubtaskDto.actor,
            addSubtaskDto.message_id,
            addSubtaskDto.type,
            addSubtaskDto.processer,
            addSubtaskDto.data
            );
        return subtask.toJson();
    }



    /**
     * 提交事物
     */
    @Post('confirm')
    async commit(@Body() body): Promise<any> {
        return (await this.messageService.confirm(body.actor,body.message_id)).toJson();
    }

    /**
     * 回滚事物
     */
    @Post('cancel')
    async rollback(@Body() body): Promise<any> {
        return (await this.messageService.cancel(body.actor,body.message_id)).toJson();
    }

}
