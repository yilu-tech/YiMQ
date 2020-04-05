import { Injectable, Logger } from "@nestjs/common";
import { SystemConfig } from './SystemConfig.';
import {safeLoad} from 'js-yaml';
import { readFileSync,readdirSync } from "fs";
import { join } from "path";
import { ActorConfig } from "./ActorConfig";
import { get } from 'lodash';
import { EventEmitter } from "events";
const chokidar = require('chokidar');

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
            this.system = this.load_system_config();
            this.event.emit(ConfigEvents.SYSTEM_CONFIG_LOAD);
        } catch (error) {
            Logger.error(error,'Config');
        }
        
        try {
            this.actors = this.load_actors_config();
            this.event.emit(ConfigEvents.ACTORS_CONFIG_LOAD);
        } catch (error) {
            Logger.error(error,'Config');
        }

        if(this.system && this.actors){
            Logger.log('Config Loaded','Config')
            this.event.emit(ConfigEvents.CONFIG_LOAD)
        }
    }

    load_system_config(){
        return new SystemConfig(this.readConfig(this.paths.system_config));
    }

    load_actors_config(){
        let actors = [];
        let fileContent = this.readConfig(this.paths.actors_config);
        fileContent.actors.forEach((actorConfig)=>{
            actors.push(actorConfig)
        })
        return actors;
    }
    

    async reloadConfig(configName){
        this[`load_${configName}`]()
        this.event.emit(`${configName}_reload`.toUpperCase());
        Logger.log(`${configName} is change`,'Config')
        if(this.system && this.actors){
            Logger.log('Config Reloaded','Config')
            this.event.emit(ConfigEvents.CONFIG_RELOAD)
        }
    }

    async setWatch(){
        chokidar.watch(process.env.CONFIG_DIR_PATH).on('change', async (path) => {
            for (const name in this.paths) {
                if(path == this.paths[name]){
                    await this.reloadConfig(name);
                }
            }
        });
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

