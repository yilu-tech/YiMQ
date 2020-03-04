
import { Coordinator } from './Coordinator';
import * as bull from 'bull';
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

}