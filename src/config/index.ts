import { Injectable } from "@nestjs/common";
import { SystemConfig } from './SystemConfig.';
import {safeLoad} from 'js-yaml';
import { readFileSync } from "fs";
import { join } from "path";
@Injectable()
export class Config {
    system: SystemConfig  = new SystemConfig(loadConfig('micromq.config.yml'));
}


function loadConfig(filePath){
    var filepath = join(process.cwd(),filePath);
    try{
        var doc = safeLoad(readFileSync(filepath,'utf8'));
        return doc;
    }catch(e){
        throw e;
    }
}