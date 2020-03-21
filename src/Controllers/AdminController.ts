import { Controller, Post, Body, Get, Query, ParseIntPipe } from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto } from '../Dto/AdminControllerDto';




@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService){

    }

    @Get('messages')
    public async index(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessagesDto){
        return this.messageService.list(actor_id,query);
    }


}
