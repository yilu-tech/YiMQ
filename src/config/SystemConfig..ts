import { ClientOpts } from "redis";

export class SystemConfig{
    readonly redis:ClientOpts;
    constructor(doc){
        this.redis = doc['redis'];
    }
}
