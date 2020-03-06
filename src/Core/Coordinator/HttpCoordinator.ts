
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
import {Logger } from '@nestjs/common';
import axios from 'axios';
import { CoordinatorCallActorAction } from '../../Constants/Coordinator';
export class HttpCoordinator extends Coordinator{
    
    public processBootstrap(){
        this.queue.process('*',1000,async (jobContext:bull.Job)=>{

            try {
                let job = await this.actor.jobManager.restore(jobContext);
                await job.process();
            } catch (err) {
                throw err;
            }
        })
    };

    public async callActor(action:CoordinatorCallActorAction,context) {
        Logger.debug(`${action}: ${this.actor.name}@${context.processer||''}`,'HttpCoordinator')

        let result = await axios.post(this.actor.api,{
            action: action,
            context: context
        });

        return result;

    }
}