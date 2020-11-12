import { Controller, Post, Body, UseInterceptors } from '@nestjs/common';
import { CreateMessageDto, AddSubtaskDto } from '../Dto/MessageDto';

import { MessageService } from '../Services/MessageService';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { OnDemandFastToJson } from '../Decorators/OnDemand';
import { Subtask } from '../Core/Subtask/BaseSubtask/Subtask';
import { ContextLoggingInterceptor } from '../Interceptors/ContextLoggingInterceptor';




@Controller('message')
@UseInterceptors(ContextLoggingInterceptor)
export class MessagesController {
    constructor(private messageService:MessageService){

    }

    /**
     * 开启事物
     */
    @Post('create')
    async begin(@Body() createMessageDto: CreateMessageDto): Promise<any> {
        let message = await this.messageService.create<TransactionMessage>(createMessageDto.actor, createMessageDto.type, createMessageDto.topic,createMessageDto.data,{
            delay: createMessageDto.delay
        });
        return OnDemandFastToJson(message);
    }

    /**
     * 创建事物任务
     */
    @Post('subtask')
    async subtask(@Body() addSubtaskDto: AddSubtaskDto): Promise<any> {
        let subtask:Subtask = await this.messageService.addSubtask(
            addSubtaskDto.actor,
            addSubtaskDto.message_id,
            addSubtaskDto.type,
            addSubtaskDto
            );
        return OnDemandFastToJson(subtask)
    }


    /**
     * 预提交
     */
    @Post('prepare')
    async prepare(@Body() body): Promise<any> {
        return (await this.messageService.prepare(body.actor,body.message_id,body));
    }

    /**
     * 提交事物
     */
    @Post('confirm')
    async commit(@Body() body): Promise<any> {
        return (await this.messageService.confirm(body.actor,body.message_id));
    }

    /**
     * 回滚事物
     */
    @Post('cancel')
    async rollback(@Body() body): Promise<any> {
        return (await this.messageService.cancel(body.actor,body.message_id));
    }

}
