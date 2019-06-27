import { Get, Controller } from '@nestjs/common';
import { CoordinatorManager } from '../services';
@Controller()
export class CoordinatorController {
  constructor(private coordinatorManager:CoordinatorManager) {
   
  }

  @Get('coordinator')
  root(): string {

    return 'queue';
  }

}
