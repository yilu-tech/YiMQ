import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';
import { MasterNohm } from '../Bootstrap/MasterNohm';
import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';
import { modelsInjects} from '../app.module';
import { ActorManager } from '../Core/ActorManager';
import { services } from '../Services';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let actorManager:ActorManager;


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterNohm,
            ...modelsInjects,
            ActorManager,
            ...services,
        ],
        }).compile();
        redisManager = app.get<RedisManager>(RedisManager);

        await redisManager.flushAllDb();
        actorService = app.get<ActorService>(ActorService);
        await actorService.loadConfigFileToMasterRedis();

        config = app.get<Config>(Config);
        actorManager = app.get<ActorManager>(ActorManager);
        
        
    });

    afterEach(async()=>{
        await redisManager.quitAllDb();
        await actorManager.closeActors();
    })
    

  


    describe('.client config', async () => {

        it('.listeners to db', async () => {
            await actorManager.initActors();

            
            mock.onPost(config.actors.get(1).api).replyOnce(200,{
                "listeners": [{
                    "processor": "Tests\\Services\\ContentUpdateListener",
                    "topic": "content@post.update",
                    "condition": null
                }]
            })
            mock.onPost(config.actors.get(2).api).replyOnce(200,{
                "listeners": [{
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                    "condition": null
                }]
            })
           
            await actorManager.loadActorsRemoteConfig()
            
            let listenerModels = await actorManager.masterModels.ListenerModel.find({});
            expect(listenerModels.length).toBe(2);//确认添加成功

            let newTopic = 'content@post.update_new';
            mock.onPost(config.actors.get(1).api).replyOnce(200,{
                "listeners": [{
                    "processor": "Tests\\Services\\ContentUpdateListener",
                    "topic": newTopic,
                    "condition": null
                },
                {
                    "processor": "Tests\\Services\\ContentDeleteListener",
                    "topic": "content@post.delete",
                    "condition": null
                }]
            })
            mock.onPost(config.actors.get(2).api).replyOnce(200,{
                "listeners": []
            })
            await actorManager.loadActorsRemoteConfig()
            let userListeners = await actorManager.masterModels.ListenerModel.findAndLoad({'actor_id':actorManager.get('user').id});
            expect(userListeners.length).toBe(2);//修改一个，添加一个，一个两个
            expect(userListeners[0].property('topic')).toBe(newTopic);//修改是否成功

            let contentListeners = await actorManager.masterModels.ListenerModel.findAndLoad({'actor_id':actorManager.get('content').id});
            expect(contentListeners.length).toBe(0); //是否删除

        });

    });

   
});
