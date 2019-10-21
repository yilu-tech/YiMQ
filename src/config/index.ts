import { Injectable, Logger } from "@nestjs/common";
import { SystemConfig } from './SystemConfig.';
import {safeLoad} from 'js-yaml';
import { readFileSync,readdirSync } from "fs";
import { join } from "path";
import { ActorConfig } from "./ActorConfig";

@Injectable()
export class Config {
    configDirPath:string;
    system: SystemConfig  ;
    actors: Map<string,ActorConfig>;
    constructor(){
        this.configDirPath = process.env.CONFIG_DIR_PATH ? process.env.CONFIG_DIR_PATH : join(process.cwd(),'config');
        this.system = new SystemConfig(this.loadConfig(join(this.configDirPath,'system.config.yml')));
        this.actors = this.loadActors();
        Logger.log('Load config.','Bootstrap');
    }

    loadActors(){
        let dirPath = join(this.configDirPath,'actors');
        let actorsMap = new Map<string,ActorConfig>();
        let files = readdirSync(dirPath,"utf8");
    
        files.forEach((filename)=>{
            let nameSplit = filename.split('.');
            let filepath = join(dirPath,filename);
            let actorConfig: ActorConfig = this.loadConfig(filepath);
            actorConfig.id = nameSplit[0];
            actorConfig.name = nameSplit[1];
            actorsMap.set(actorConfig.id,actorConfig);
        })
        return actorsMap;
    }
    
    
    loadConfig(filepath){
        try{
            var doc = safeLoad(readFileSync(filepath,'utf8'));
            return doc;
        }catch(e){
            throw e;
        }
    }
}

