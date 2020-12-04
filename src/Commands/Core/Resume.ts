import {App} from "../CommandApp";
export async function resume(){
    let app = new App();
    await app.initConfig();
    await app.initContext();

    let actors = app.actorManager.actors;
    for(let[id,actor] of actors){
        await actor.coordinator.resume()
     }
     await app.closeContext()
}