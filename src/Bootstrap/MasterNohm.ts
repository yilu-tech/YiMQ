
import  {NohmClass} from 'nohm';
import { RedisManager } from "../handlers/redis/RedisManager"


/**
 * 配置masterNohm注入redis client
 */
export const MasterNohm = {
  provide: 'masterNohm',
  useFactory: async (redisManager:RedisManager) => {
    let redisClient = await redisManager.client();
    const defaultNohm = new NohmClass({})
    defaultNohm.setClient(redisClient);
    return defaultNohm;
  },
  inject:[RedisManager]
}

