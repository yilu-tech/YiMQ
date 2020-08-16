import { Controller, Post, Body, Get, Query, ParseIntPipe} from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto } from '../Dto/AdminControllerDto';
import {ActorManager} from '../Core/ActorManager';
import { Application } from '../Application';


@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService,private actorManager:ActorManager,private application:Application){

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
    @Get('reload')
    public async reload(){
        await this.application.reload();
        return {message:'success'};
    }


}
