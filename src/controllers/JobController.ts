import { Get, Controller, Post, Body } from '@nestjs/common';
import { CoordinatorManager } from '../Services/CoordinatorManager';


import { CreateJobDto } from '../Dto/JobDto';
import { QueueCoordinator } from '../Services/Coordinator/QueueCoordinator';
@Controller('jobs')
export class JobController {
  constructor(private coordinatorManager:CoordinatorManager) {

  }

  @Post()
  async root(@Body() createJobDto:CreateJobDto): Promise<any> {
    let coordinator:QueueCoordinator =  this.coordinatorManager.get(createJobDto.coordinator);
    return await coordinator.create({date: Date()});
  }

}
