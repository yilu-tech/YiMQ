import { Config, ConfigEvents } from "./Config";
import { Application } from "./Application";
import { Logger} from './Handlers/Logger';
import { ActorManager } from "./Core/ActorManager";


export const Bootstrap = {
  provide: 'Bootstrap',
  useFactory: async(config:Config,application:Application,actroManager:ActorManager)=>{

    
    config.event.on(ConfigEvents.CONFIG_LOAD,async ()=>{
      Logger.log('........Application bootstrap........','Bootstrap');
      await application.bootstrap()
      Logger.log('........Application is running........','Bootstrap');
    })

    config.event.on(ConfigEvents.CONFIG_RELOAD,async ()=>{
      await actroManager.saveConfigFileToMasterRedis();
      await application.publishActorsConfigChange();
    })



    let topic = 'config_update';
    process.on('message', async(packet)=>{
      if(packet.topic != topic)return;
      Logger.log('........Config update start........','Bootstrap');
      await config.reloadConfig('actors_config');
      process.send({
        type : `process:${topic}`,
        message_id: packet.message_id,
        data : {
          message_id:packet.message_id,
          message: 'success'
        }
     });
    });

    await config.loadConfig()
    
  },
  inject:[Config,Application,ActorManager]
}
