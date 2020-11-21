import { Injectable } from "@nestjs/common";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import * as pino from "pino";

@Injectable()
export class ContextLogger{
    private logger:pino.Logger;
    constructor(){
        let logDir = join(process.cwd(),'logs');
        if(!existsSync(logDir)){
            mkdirSync(logDir);
        }
        let logFile = join(logDir,'context.log')
        this.logger =  pino(pino.destination({
            dest: logFile
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