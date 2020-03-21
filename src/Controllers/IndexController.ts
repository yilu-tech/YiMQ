import { Controller,Get } from '@nestjs/common';





@Controller()
export class IndexController {
    constructor(){

    }
    @Get()
    public async index(){
        return 'YiMQ is running.';
    }

}
