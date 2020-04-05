import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';

import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { MasterModels } from '../../Models/MasterModels';
import { join } from 'path';
import { RedisClient } from '../../Handlers/redis/RedisClient';
import { MasterNohm } from '../../Bootstrap';
import { ActorManager } from '../../Core/ActorManager';
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('ActorConfigLoadToMasterRedis.spec', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let redisClient:RedisClient;
    let actorManager:ActorManager;
    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'../config');

        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterNohm,
            MasterModels,
            ActorService,
            ActorManager,
        ],
        }).compile();
        actorService = app.get<ActorService>(ActorService);
        config = app.get<Config>(Config);
        redisManager = app.get<RedisManager>(RedisManager);
        actorManager = app.get<ActorManager>(ActorManager);
        redisClient = await redisManager.client();
        await redisClient.flushdb();
    });

    afterEach(async()=>{
        await redisManager.quitAllDb();
    })

    it('Load config file to redis.', async () => {
       
        await actorManager.saveConfigFileToMasterRedis()
        let actors = await actorService.list();
        expect(actors.length).toBe(2);
    });
});
