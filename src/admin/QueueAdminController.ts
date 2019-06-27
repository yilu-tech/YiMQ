import { Get, Controller } from '@nestjs/common';
@Controller()
export class QueueController {
  constructor() {}

  @Get('queue')
  root(): string {
    return 'queue';
  }

}
