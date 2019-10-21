import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';
import { MasterNohm } from '../../Bootstrap/MasterNohm';
import { ActorService } from '../ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { MasterModels } from '../..//Models/MasterModels';
import { join } from 'path';

describe('ActorConfigLoadToMasterRedis.spec', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');

        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterNohm,
            MasterModels,
            ActorService,
        ],
        }).compile();
        actorService = app.get<ActorService>(ActorService);
        config = app.get<Config>(Config);
        redisManager = app.get<RedisManager>(RedisManager);

        await redisManager.client().flushdb();
    });

    describe('root', () => {
        it('Load config file to redis.', async () => {
            await actorService.loadConfigFileToMasterRedis();
            let actors = await actorService.list();
            expect(actors.length).toBe(2);
        });
    });
});
