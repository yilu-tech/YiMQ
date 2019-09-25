import { Get, Controller, Post, Put, Delete, Patch, Body, Param, Inject, Query } from '@nestjs/common';
import { ActorModel } from '../Models/ActorModel';
import { ActorService } from '../Services/ActorService';


@Controller('admin/actors')
export class ActorController {
  constructor(private actorService:ActorService) {

  }

  @Post('')
  async create(@Body() body): Promise<any> {
    return await this.actorService.create(body)
  }

  @Get(':id')
  async get(@Param() params): Promise<any> {
    return await this.actorService.get(params.id);
  }

  @Get('')
  async all(): Promise<any> {
    return this.actorService.all();
  }

  @Delete(':id')
  async delete(@Param() params):Promise<any>{
    return this.actorService.delete(params.id);
  }

  @Put(':id')
  async update(@Param() params,@Body() body):Promise<any>{

    return this.actorService.update(params.id,body);
  }
}


