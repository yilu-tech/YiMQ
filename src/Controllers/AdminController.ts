import { Controller, Post, Body, Get, Query, ParseIntPipe} from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto, MessageClearFailedRetry, ClearFailedRetry } from '../Dto/AdminControllerDto';
import {ActorManager} from '../Core/ActorManager';
import { Application } from '../Application';
import { BusinessException } from '../Exceptions/BusinessException';
import { ActorService } from '../Services/ActorService';


@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService,private actorManager:ActorManager,private application:Application,private actorService:ActorService){

    }

    @Get('messages')
    public async messages(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessagesDto){
        return this.messageService.list(actor_id,query);
    }
    @Get('message')
    public async message(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessageDetailDto){
        return (await this.messageService.get(actor_id,query.message_id)).toJson(true);
    }

    @Get('actor/clearfailed')
    public async clearfailed(@Query() body){
        if(!body.actor_id){
            return await this.actorService.getAllClearFailedList();    
        }
      return this.actorService.getClearFailedList(body.actor_id)
    }
    @Post('actor/clearfailed/retry')
    public async messageClearFailedRetry(@Body() body:MessageClearFailedRetry){
        let actor = this.actorManager.getById(body.actor_id);    
        if(!actor){
            throw new BusinessException(`actor_id ${body.actor_id} is not exists.`)
        }
        return await actor.actorCleaner.clearFailedReTry(body.message_ids,body.process_ids);
    }
    @Get('reload')
    public async reload(@Query() query){
        await this.application.reload(query.name);
        return {message:'success'};
    }


}
