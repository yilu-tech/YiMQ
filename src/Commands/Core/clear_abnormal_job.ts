
import {App} from "../CommandApp";
import { MessageStatus, MessageClearStatus } from "../../Constants/MessageConstants";
import { Actor } from "../../Core/Actor";
import { id } from "date-fns/locale";
import { ActorStatus } from "../../Constants/ActorConstants";

export async function clear_abnormal_job(){
    console.log('migrate to clear_abnormal_job')
    let app = new App();
    console.time('time:')
    await app.initConfig();
    await app.initContext();
    await clearJobIndex(app);
    await clear(app);
    await app.closeContext()
    console.timeEnd('time:')
}

async function clearJobIndex(app:App) {
    console.log('---------- clearJobIndex')
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


async function clear(app:App){

    console.log('---------- clear')
    let actors = app.actorManager.actors;
    for (const [id,actor] of actors) {
        let abnormal_jobs = []
        
        let jobContexts = await actor.coordinator.getQueue().getJobs(['completed','waiting','active','delayed','failed','paused']);

        for (const jobContext of jobContexts) {
            if(!jobContext){
                console.warn(`Coordinator (${this.actor.name}) has faild index in bull:${this.actor.id}:failed.`)
                continue;
            }
            try {
                let job = await actor.jobManager.restoreByContext(jobContext);//如果恢复失败的就是丢失上下文的job
            } catch (error) {
                let jobJson = jobContext.toJSON(); 
                jobJson['error_message'] = error.message;
                abnormal_jobs.push(jobJson);
                jobContext.remove()
            }
        }
        console.log(`${actor.id} ${actor.name} 共: ${jobContexts.length} 清理: ${abnormal_jobs.length}`)
        
    }

  
}




