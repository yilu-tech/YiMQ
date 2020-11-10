import { Controller, Post, Body, Get, Query, ParseIntPipe, ParseArrayPipe} from '@nestjs/common';
import { MessageService } from '../Services/MessageService';
import { MessagesDto, MessageDetailDto, MessageClearFailedRetry, ClearFailedRetry, ActorJobsDao ,ActorJobDto,ActorDao, ActorJobRetryDto} from '../Dto/AdminControllerDto';
import {ActorManager} from '../Core/ActorManager';
import { Application } from '../Application';
import { BusinessException } from '../Exceptions/BusinessException';
import { ActorService } from '../Services/ActorService';
import { Actor } from '../Core/Actor';
import { AdminService } from '../Services/AdminService';


@Controller('admin')
export class AdminController {
    constructor(
        private messageService:MessageService,
        private actorManager:ActorManager,
        private application:Application,
        private actorService:ActorService,
        private adminService:AdminService
        ){

    }

    @Get('/')
    public async home(){
       return this.adminService.home();
    }

    @Get('messages')
    public async messages(
        @Query('actor_id',new ParseIntPipe()) actor_id,
        @Query('status' ,new ParseArrayPipe({optional:true})) status:[],
        @Query() query:MessagesDto
        ){
            query.status = status;
            return this.messageService.search(actor_id,query);
    }
    @Get('message')
    public async message(@Query() query:MessageDetailDto){
        return (await this.messageService.get(query.actor_id,query.message_id));
    }

    @Get('actor/job')
    public async actorJob(
        @Query() query:ActorJobDto,
        ){
       return this.actorService.job(query.actor_id,query.job_id);
    }

    @Post('actor/job/retry')
    public async actorJobRetry(
        @Body() body:ActorJobRetryDto,
        ){
       return this.actorService.jobRetry(body.actor_id,body.job_ids);
    }

    @Get('actor/jobs')
    public async actorJobs(
        @Query() query:ActorJobsDao,
        @Query('status', ParseArrayPipe) status: [],
        ){
       return this.actorService.jobs(query.actor_id,status,query.start,query.size,query.sort);
    }
    @Get('actor/status')
    public async actorStatus(@Query() query:ActorDao){
        return this.actorService.getStatus(query.actor_id);
    }

    //todo: remove
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
