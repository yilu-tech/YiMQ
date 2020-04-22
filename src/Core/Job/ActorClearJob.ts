import { Job } from "./Job";
import { Actor } from "../Actor";
import Bull = require("bull");


export class ActorClearJob extends Job{

    constructor(public actor:Actor,public readonly context:Bull.Job){
        super(context);
    }
    async process() {
        let result =  await this.actor.actorCleaner.clearActor();
        await this.actor.actorCleaner.setClearJob();
        return result;
    }

    public toJson(full=false){
        let json = super.toJson(full);
        delete json['actor'];
        return json;
    }
    
}