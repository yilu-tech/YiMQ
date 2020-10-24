
import {App} from "../CommandApp";
import { MessageStatus, MessageClearStatus } from "../../src/Constants/MessageConstants";
import { Actor } from "../../src/Core/Actor";
import { id } from "date-fns/locale";
import { ActorStatus } from "../../src/Constants/ActorConstants";

export async function run_02_migrate_10(){
    console.log('migrate to v1.0')
    let app = new App();
    console.time('fix actor status:')
    await fixActorStatus(app);
    console.timeEnd('fix actor status:')


    console.time('fix waiting word miss:')
    await fixWaitingWordMiss(app)
    console.timeEnd('fix waiting word miss:')

    
   
}


async function fixWaitingWordMiss(app:App){

    await app.initConfig();
    await app.initContext();
    let actors = app.actorManager.actors;
    for (const [id,actor] of actors) {
        
        let oldKey = `actors:${actor.id}:wating_clear_processors`;
        let newKey = actor.actorCleaner.db_key_waiting_clear_processors;

        let fixResult = {};
        fixResult['old'] = await actor.redisClient.scard(oldKey)
        fixResult['new_current'] = await actor.redisClient.scard(newKey)
        let multi = actor.redisClient.multi()
        multi.sunionstore(newKey,oldKey,newKey)
        multi.del(oldKey);
        await multi.exec();
        fixResult['new_fixed'] = await actor.redisClient.scard(newKey)
        console.log(`${actor.id}-${actor.name}`,fixResult);
    }

    await app.closeContext()
}


async function fixActorStatus(app){

    await app.initConfig();
    await app.initContext();

    


    let actorIds = await app.masterModels.ActorModel.sort({
        field: 'id'
    },false);
    let actorModels = await app.masterModels.ActorModel.loadMany(actorIds);
    
    for (const actorModel of actorModels) {
        let status = actorModel.property('status');
        console.log(`${actorModel.id} ${status}`)

        actorModel.property('status',ActorStatus.INACTIVE);
        await actorModel.save();

        actorModel.property('status',status);
        await actorModel.save();
    }

    
    await app.closeContext()
}
