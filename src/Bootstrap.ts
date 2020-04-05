import { Config, ConfigEvents } from "./Config";
import { Application } from "./Application";


export const Bootstrap = {
  provide: 'Bootstrap',
  useFactory: async(config:Config,application:Application)=>{

    
    config.event.on(ConfigEvents.CONFIG_LOAD,async ()=>{
      await application.bootstrap()
    })
    config.event.on(ConfigEvents.CONFIG_RELOAD,async ()=>{
      await application.shutdown()
      await application.bootstrap()
      
    })

    await config.loadConfig()
    await config.setWatch();
  },
  inject:[Config,Application]
}
