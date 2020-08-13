import { Job } from "./Job";
import { Actor } from "../Actor";
import Bull = require("bull");


export class ActorClearJob extends Job{

    constructor(public actor:Actor,public readonly context:Bull.Job){
        super(context);
    }
    async process() {
        let result =  await this.actor.actorCleaner.run();
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