import { Get, Controller, Post, Put, Delete, Patch, Body, Param, Inject, Query } from '@nestjs/common';
import { ActorModel } from '../Models/ActorModel';
import { ModelFactory } from '../Handlers/ModelFactory';
import { ActorService } from '../Services/ActorService';


@Controller('admin/actors')
export class ActorController {
  constructor(private modelFactory:ModelFactory,private actorService:ActorService) {

  }

  @Post('')
  async create(@Body() body): Promise<any> {
    return await this.actorService.create(body)
  }

  @Get(':name')
  async get(@Param() params): Promise<any> {
    let actor = await this.actorService.get(params.name);
    if(actor){
      return actor.toJson();
    }else{
      return null;
    } 
  }

  @Get('')
  async all(): Promise<any> {
    return this.actorService.all();
  }

  @Delete(':name')
  async delete(@Param() params):Promise<any>{
    return this.actorService.delete(params.name);
  }

  @Put(':name')
  async update(@Param() params,@Body() body):Promise<any>{

    return this.actorService.update(params.name,body);
  }
}


