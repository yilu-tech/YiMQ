import { Injectable } from "@nestjs/common";
import { SystemConfig } from './SystemConfig.';
import {safeLoad} from 'js-yaml';
import { readFileSync,readdirSync } from "fs";
import { join } from "path";
import { ActorConfig, actorDefaultOptions } from "./ActorConfig";
import { EventEmitter } from "events";
import {AppLogger as Logger} from '../Handlers/AppLogger';

process.env.CONFIG_DIR_PATH = process.env.CONFIG_DIR_PATH || join(process.cwd(),'config');

export enum ConfigEvents{
    SYSTEM_CONFIG_LOAD = 'SYSTEM_CONFIG_LOAD',
    ACTORS_CONFIG_LOAD= 'ACTORS_CONFIG_LOAD',
    SYSTEM_CONFIG_RELOAD='SYSTEM_CONFIG_RELOAD',
    ACTORS_CONFIG_RELOAD= 'ACTORS_CONFIG_RELOAD',
    CONFIG_LOAD = 'CONFIG_LOAD',
    CONFIG_RELOAD = 'CONFIG_RELOAD',
}
@Injectable()
export class Config {
    public event:EventEmitter = new EventEmitter();
    configDirPath:string;
    paths = {
        system_config: join(process.env.CONFIG_DIR_PATH,'system.config.yml'),
        actors_config: join(process.env.CONFIG_DIR_PATH,'actors.config.yml')
    }
    system: SystemConfig  = null;
    actors: Array<ActorConfig> = null;
    constructor(){

    }


        
    async loadConfig(){
        try {
            this.load_system_config();
            Logger.debug(`system_config is loaded`,'Config')
            this.event.emit(ConfigEvents.SYSTEM_CONFIG_LOAD);
        } catch (error) {
            Logger.error(error,'Config');
        }
        
        try {
            this.load_actors_config();
            Logger.debug(`actors_config is loaded`,'Config')
            this.event.emit(ConfigEvents.ACTORS_CONFIG_LOAD);
        } catch (error) {
            Logger.error(error,'Config');
        }

        if(this.system && this.actors){
            Logger.log('All configs Loaded','Config')
            this.event.emit(ConfigEvents.CONFIG_LOAD)
        }
        return this;
    }

    load_system_config(){
        this.system = new SystemConfig(this.readConfig(this.paths.system_config));
    }

    load_actors_config(){
        let actors = [];
        let fileContent = this.readConfig(this.paths.actors_config);
        fileContent['actors'] && fileContent['actors'].forEach((actorConfig)=>{
            let default_options = Object.assign({},actorDefaultOptions);
            let common_options = Object.assign(default_options,fileContent['common_options']);
            actorConfig.options = Object.assign(common_options,actorConfig.options);
            actors.push(actorConfig)
        })
        this.actors = actors;
    }
    

    private readConfig(filepath){
        try{
            var doc = safeLoad(readFileSync(filepath,'utf8'));
            return doc;
        }catch(e){
            throw e;
        }
    }
}

