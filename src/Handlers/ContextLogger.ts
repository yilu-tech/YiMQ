import { Injectable } from "@nestjs/common";
import * as pino from "pino";

@Injectable()
export class ContextLogger{
    private logger:pino.Logger;
    constructor(){
        this.logger =  pino(pino.destination({
            dest: './logs/context.log'
        }))
    }

    info(...args){
        this.logger.info.apply(this.logger,args);
    }
    error(...args){
        this.logger.error.apply(this.logger,args);
    }
    child(bindings: pino.Bindings){
        return this.logger.child(bindings);
    }
}