import { Controller, Post, Body, Get, Query, ParseIntPipe, Param } from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto } from '../Dto/AdminControllerDto';




@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService){

    }

    @Get('messages')
    public async messages(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessagesDto){
        return this.messageService.list(actor_id,query);
    }
    @Get('message')
    public async message(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessageDetailDto){
        return (await this.messageService.get(actor_id,query.message_id)).toJson();
    }


}
