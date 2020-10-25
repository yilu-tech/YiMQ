import { Job } from "./Job";
import { Actor } from "../Actor";
import Bull = require("bull");
// const timeout = ms => new Promise(res => setTimeout(res, ms))

export class ActorClearJob extends Job{

    constructor(public actor:Actor,public readonly context:Bull.Job){
        super(context);
    }
    async process() {
        await this.actor.actorCleaner.clearSelfJob(); //清理除这个job以外的actor_clear_job
        let result =  await this.actor.actorCleaner.run();
        // await timeout(1000*10);
        await this.actor.actorCleaner.setNextClearJob(this);
        return result;
    }

    public toJson(full=false){
        let json = super.toJson(full);
        delete json['actor'];
        return json;
    }
    
}