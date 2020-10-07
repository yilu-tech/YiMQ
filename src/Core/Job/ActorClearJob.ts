import { Job } from "./Job";
import { Actor } from "../Actor";
import Bull = require("bull");


export class ActorClearJob extends Job{

    constructor(public actor:Actor,public readonly context:Bull.Job){
        super(context);
    }
    async process() {
        let result =  await this.actor.actorCleaner.run();
        await this.actor.actorCleaner.clearSelfJob(); //清理除这个job以外的actor_clear_job
        return result;
    }

    async onCompleted(job,result){
        await this.actor.actorCleaner.setClearJob(result.delay);
    }

    public toJson(full=false){
        let json = super.toJson(full);
        delete json['actor'];
        return json;
    }
    
}