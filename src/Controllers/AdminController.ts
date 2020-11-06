import { Controller, Post, Body, Get, Query, ParseIntPipe, ParseArrayPipe} from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto, MessageClearFailedRetry, ClearFailedRetry, ActorJobsDao ,ActorJobDto,ActorDao} from '../Dto/AdminControllerDto';
import {ActorManager} from '../Core/ActorManager';
import { Application } from '../Application';
import { BusinessException } from '../Exceptions/BusinessException';
import { ActorService } from '../Services/ActorService';
import { Actor } from '../Core/Actor';


@Controller('admin')
export class AdminController {
    constructor(private messageService:MessageService,private actorManager:ActorManager,private application:Application,private actorService:ActorService){

    }

    @Get('messages')
    public async messages(@Query('actor_id',new ParseIntPipe()) actor_id,@Query() query:MessagesDto){
        return this.messageService.list(actor_id,query);
    }
    @Get('message')
    public async message(@Query() query:MessageDetailDto){
        return (await this.messageService.get(query.actor_id,query.message_id));
    }
    @Get('actors')
    public async actors(){
       return this.actorService.list();
    }
    @Get('actor/job')
    public async actorJob(
        @Query() query:ActorJobDto,
        ){
       return this.actorService.job(query.actor_id,query.job_id);
    }
    @Get('actor/jobs')
    public async actorJobs(
        @Query() query:ActorJobsDao,
        @Query('types', ParseArrayPipe) types: [],
        ){
       return this.actorService.jobs(query.actor_id,types,query.start,query.end,query.asc);
    }
    @Get('actor/status')
    public async actorStatus(@Query() query:ActorDao){
        return this.actorService.getStatus(query.actor_id);
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
