
import {App} from "../CommandApp";

export async function clear_abnormal_job_index(){
    console.log('migrate to clear_abnormal_job_index')
    let app = new App();
    console.time('time:')
    await app.initConfig();
    await app.initContext();
    await clearJobIndex(app);
    await app.closeContext()
    console.timeEnd('time:')
}

async function clearJobIndex(app:App) {
    let actors = app.actorManager.actors;
    let statusItems = ['completed','waiting','active','delayed','failed','paused']
    for (const [id,actor] of actors) {

        
        let idsTotal = 0;
        for (const statusItem of statusItems) {
            idsTotal += await clearJobStatusIndex(actor,statusItem)
        }
        console.log(actor.id,actor.name,idsTotal)
    }
    
}

async function clearJobStatusIndex(actor,status) {
    let ids = await actor.redisClient.zrange(`bull:${actor.id}:${status}`,0,-1);
    for (const jobId of ids) {
        if(await actor.redisClient.exists(`bull:${actor.id}:${jobId}`) == 0){
            await actor.redisClient.zrem(`bull:${actor.id}:${status}`,jobId)
            console.log('clear',actor.id,actor.name,jobId);
        }           
    }
    return ids.length;
}