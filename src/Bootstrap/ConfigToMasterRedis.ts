
import { ActorService } from "../Services/ActorService";



export const ConfigToMasterRedis = {
    provide: 'configToMasterRedis',
    useFactory: async (actorService:ActorService) => {
        await actorService.loadConfigFileToMasterRedis();
    },
    inject:[ActorService]
}