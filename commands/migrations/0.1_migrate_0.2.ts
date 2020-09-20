
import {App} from "../CommandApp";
import { MessageStatus, MessageClearStatus } from "../../src/Constants/MessageConstants";
import { Actor } from "../../src/Core/Actor";

export async function run_01_migrate_02(){
    console.log('migrate to v2')
    let app = new App();
    await app.init();

    let actors = app.actorManager.actors;
    
    console.time('fix message cost all time:')
    for(let[id,actor] of actors){
       await fixActorMessagesClearStatus(actor);
    }
    console.timeEnd('fix message cost all time:')


    console.time('remove clear job cost all time:')
    for(let[id,actor] of actors){
       await removeActorClearJob(actor);
    }
    console.timeEnd('remove clear job cost all time:')


    


    await app.close()
   
}

async function removeActorClearJob(actor:Actor){
    let cleaner_last_job_id_key = `actors:${actor.id}:cleaner_last_job_id`;
    let clear_job_id_key = `actors:${actor.id}:cleaner_job_id`;
    let cleaner_last_job_id = await actor.redisClient.get(cleaner_last_job_id_key);
    let cleaner_job_id = await actor.redisClient.get(clear_job_id_key);

    let cleaner_last_job = await actor.coordinator.getQueue().getJob(cleaner_last_job_id);
    cleaner_last_job && await cleaner_last_job.remove();

    let cleaner_job = await actor.coordinator.getQueue().getJob(cleaner_job_id);
    cleaner_job && await cleaner_job.remove();

    await actor.redisClient.del(cleaner_last_job_id_key)
    await actor.redisClient.del(clear_job_id_key)
}

async function fixActorMessagesClearStatus(actor:Actor){
    let doneMessages = await actor.messageModel.find({
        actor_id: actor.id,
        status: MessageStatus.DONE
    });
    let canceledMessages = await actor.messageModel.find({
        actor_id: actor.id,
        status: MessageStatus.CANCELED
    });
    let pendingMessages = await actor.messageModel.find({
        actor_id: actor.id,
        status: MessageStatus.PENDING
    });
    
    console.log(`${actor.name} ==> done: ${doneMessages.length}     canceled: ${canceledMessages.length}     pending:${pendingMessages.length}`)
    let promises = [];

    for(let messageId of doneMessages){
       promises.push(fixMessage(actor,messageId));
    }

    for(let messageId of canceledMessages){
        promises.push(fixMessage(actor,messageId));
     }
    await Promise.all(promises);
}


async function fixMessage(actor:Actor,messageId){

    try {
        let message = await actor.messageModel.load(messageId);
        message.property('clear_status',MessageClearStatus.WAITING);
        await message.save();
    } catch (error) {
        console.log(`----> ${messageId} ${error.message}`)    
    }

}