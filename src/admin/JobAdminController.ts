import { Controller, Get, Query } from "@nestjs/common";
import { CoordinatorManager } from "../Services/CoordinatorManager";
import { Coordinator } from "../Services/Coordinator/Coordinator";
import { BusinessException } from "../Exceptions/BusinessException";
import { Job } from "../Services/Job/Job";
import { GetJobDto } from "../Dto/JobDto";

@Controller('admin/jobs')
export class JobAdminController{

    constructor(private coordinatorManager:CoordinatorManager){

    }

    @Get('retry')
    async retry(@Query() query:GetJobDto){
        let coordinator:Coordinator = this.coordinatorManager.get(query.coordinator);
        if(!coordinator){
            throw new BusinessException('Coordinator does not exist.');
        }
        let job:Job = await coordinator.getJob(query.id);
        await job.retry();
        return job.toJson();
    }

}