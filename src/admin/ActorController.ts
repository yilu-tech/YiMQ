import { Get, Controller, Post, Put, Delete, Patch, Body, Param, Inject, Query } from '@nestjs/common';
import { ActorModel } from '../services/Actor/ActorModel';
import { ModelFactory } from '../handlers/ModelFactory';


@Controller('admin/actors')
export class ActorController {
  constructor(private modelFactory:ModelFactory) {

  }

  @Post('')
  async create(@Body() body): Promise<any> {
    let actor = this.modelFactory.assign(ActorModel,body);
    actor = await this.modelFactory.create(actor);
    return actor.toJson();
  }

  @Get(':name')
  async get(@Param() params): Promise<any> {
    let actor = await this.modelFactory.find(ActorModel,params.name)
    if(actor){
      return actor.toJson();
    }else{
      return null;
    } 
  }

  @Get('')
  async all(): Promise<any> {
    return await this.modelFactory.all<ActorModel>(ActorModel);
  }

  @Delete(':name')
  async delete(@Param() params):Promise<any>{
    return await this.modelFactory.delete(ActorModel,params.name);
  }

  @Put(':name')
  async update(@Param() params,@Body() body):Promise<any>{

    return await this.modelFactory.update(ActorModel,params.name,body);
  }
}


