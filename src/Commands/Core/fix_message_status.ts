
import { MessageStatus } from "../../Constants/MessageConstants";
import { Actor } from "../../Core/Actor";
import { TransactionMessage } from "../../Core/Messages/TransactionMessage";
import {App} from "../CommandApp";

export async function fix_message_status(){
    console.log('migrate to clear_abnormal_job')
    let app = new App();
    console.time('time:')
    await app.initConfig();
    await app.initContext();
    await fix(app);
    await app.closeContext()
    console.timeEnd('time:')
}

async function fix(app:App){

    let actors = app.actorManager.actors;
    for (const [id,actor] of actors) {

        await fixOneStatus(actor,MessageStatus.CANCELED)
        await fixOneStatus(actor,MessageStatus.CANCELLING)
        await fixOneStatus(actor,MessageStatus.DOING)
        await fixOneStatus(actor,MessageStatus.DONE)
        await fixOneStatus(actor,MessageStatus.PENDING)
        await fixOneStatus(actor,MessageStatus.PREPARED)
    }

    
  
}

async function fixOneStatus(actor:Actor,indexStatus:MessageStatus) {
    let ids = await actor.redisClient.sinter(`nohm:index:message:status:${indexStatus}`,`nohm:index:message:actor_id:${actor.id}`)
    let messageIds = []
    for (const id of ids) {
        try {
            var message = <TransactionMessage> await actor.messageManager.get(id);    
        } catch (error) {
            console.log(error)
            continue;
        }
        
        if(message.status != indexStatus){
            let targetStatus = message.status == MessageStatus.PREPARED? MessageStatus.PENDING : message.status
            await actor.redisClient.smove(`nohm:index:message:status:${indexStatus}`,`nohm:index:message:status:${targetStatus}`,message.id)
            console.log(`actor ${actor.name}: `,message.id,indexStatus,targetStatus)
            messageIds.push(message.id)
        }
    }
    console.log(messageIds.length)
    
}






