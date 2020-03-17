import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';
import { MasterNohm } from '../../Bootstrap/MasterNohm';
import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { MasterModels } from '../../Models/MasterModels';
import { join } from 'path';
import { RedisClient } from '../../Handlers/redis/RedisClient';
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('ActorConfigLoadToMasterRedis.spec', () => {

    let config:Config;

    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'../config');

        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
        ],
        }).compile();
        config = app.get<Config>(Config);

    });



    it('Load config and base check.', async () => {
        expect(config.actors.get(1).name).toBe('user');
    });
});
