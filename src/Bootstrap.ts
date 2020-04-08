import { Config, ConfigEvents } from "./Config";
import { Application } from "./Application";
import { Logger} from './Handlers/Logger';


export const Bootstrap = {
  provide: 'Bootstrap',
  useFactory: async(config:Config,application:Application)=>{

    
    config.event.on(ConfigEvents.CONFIG_LOAD,async ()=>{
      Logger.log('........Application start........','Bootstrap');
      await application.bootstrap()
      Logger.log('........Application started........','Bootstrap');
    })

    config.event.on(ConfigEvents.CONFIG_RELOAD,async ()=>{
      Logger.log('........Application restart........','Bootstrap');
      await application.shutdown()
      await application.bootstrap()
      Logger.log('........Application restarted........','Bootstrap');
      
    })



    let topic = 'config_update';
    process.on('message', async(packet)=>{
      if(packet.topic != topic)return;
      Logger.log('........Config update start........','Bootstrap');
      await config.reloadConfig('actors_config');
      Logger.log('........Config update end........','Bootstrap');
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
  inject:[Config,Application]
}
