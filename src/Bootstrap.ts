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

    await config.loadConfig()
    await config.setWatch();
  },
  inject:[Config,Application]
}
