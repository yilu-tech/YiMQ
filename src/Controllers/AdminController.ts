import { Controller, Post, Body, Get, Query, ParseIntPipe} from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto } from '../Dto/AdminControllerDto';
import {ActorManager} from '../Core/ActorManager';



@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService,private actorManager:ActorManager){

    }

    @Get('messages')
    public async messages(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessagesDto){
        return this.messageService.list(actor_id,query);
    }
    @Get('message')
    public async message(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessageDetailDto){
        return (await this.messageService.get(actor_id,query.message_id)).toJson(true);
    }
    @Post('actor/clearfailed/retry')
    public async messageClearFailedRetry(@Body() body){
        let actor = this.actorManager.getById(body.id);    
        return await actor.actorCleaner.clearFailedReTry(body.message_ids,body.processor_ids,true);
        
    }


}
