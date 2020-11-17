import { Job } from "./Job";
import { Actor } from "../Actor";
// const timeout = ms => new Promise(res => setTimeout(res, ms))
import { Job as BullJob} from 'bullmq';
export class ActorClearJob extends Job{

    constructor(public actor:Actor,public readonly context:BullJob){
        super(context);
    }
    async process() {
        await this.actor.actorCleaner.clearSelfJob(); //清理除这个job以外的actor_clear_job
        let result =  await this.actor.actorCleaner.run();
        // await timeout(1000*10);
        await this.actor.actorCleaner.setNextClearJob(this);
        return result;
    }

    // public toJson(){
    //     let json = super.toJson();
    //     delete json['actor'];
    //     return json;
    // }
    
}