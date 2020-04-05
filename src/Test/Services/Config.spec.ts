import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';
import { join } from 'path';
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Config', () => {

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
        await config.loadConfig();
        expect(config.actors[0].name).toBe('user');
    });
});
