
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
import { Logger } from '@nestjs/common';
import { Job } from '../Job/Job';
import { JobType } from '../../Constants/JobConstants';
import { compareAsc, format } from 'date-fns'
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
const mock = new MockAdapter(axios);
export class HttpCoordinator extends Coordinator{
    
    public processBootstrap(){
        this.queue.process('*',1000,async (jobContext:bull.Job)=>{

            try {
                let job = await this.actor.jobManager.restore(jobContext);
                await this.process(job);
            } catch (err) {
                throw err;
            }
        })
    };
    /**
     * 远程请求，只有成功和失败
     * @param job 
     */
    private async process(job:Job){
        switch (job.type) {
            case JobType.TRANSACTION:
                await this.transactionJobProcess(job);
                break;
            case JobType.TRANSACTION_ITEM:
                await this.transactionItemJobProcess(job);
                break;
            case JobType.GENERAL:
                await this.generalJobProcess(job);
            default:
                throw new Error('JobType is not exists.');
        }
    }
    async callConsumer(job:Job){
        //get consumer by job.id job.type job.action
        //return success or failed  200成功 300/400失败  500 都不断重试直至成功

    }

    async transactionJobProcess(job:Job){
        let result = await axios.post(job.message.producer.api,{
            action: job.action,
            message_id: job.message_id
        });
    }

    async transactionItemJobProcess(job){

    }

    async generalJobProcess(job){

    }

}