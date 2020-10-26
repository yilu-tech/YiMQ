import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';

import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { MasterModels } from '../../Models/MasterModels';
import { join } from 'path';
import { RedisClient } from '../../Handlers/redis/RedisClient';
import { ActorConfigManager } from '../../Core/ActorConfigManager';
import { ActorManager } from '../../Core/ActorManager';
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('ActorConfigLoadToMasterRedis.spec', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let redisClient:RedisClient;
    let actorConfigManager:ActorConfigManager;
    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'../config');

        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
            ActorManager,
            ActorService,
            ActorConfigManager,
        ],
        }).compile();
        config = app.get<Config>(Config);
        await config.loadConfig()
        let masterModels = app.get<MasterModels>(MasterModels);
        await masterModels.register()
        actorService = app.get<ActorService>(ActorService);

        
        
        redisManager = app.get<RedisManager>(RedisManager);
        actorConfigManager = app.get<ActorConfigManager>(ActorConfigManager);
        redisClient = await redisManager.client();
        await redisClient.flushdb();
    });

    afterEach(async()=>{
        await redisManager.closeAll();
    })

    it('Load config file to redis.', async () => {
       
        await actorConfigManager.saveConfigFileToMasterRedis()
        let actors = await actorService.list();
        expect(actors.length).toBe(3);
    });
});
