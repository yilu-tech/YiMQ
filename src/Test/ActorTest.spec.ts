import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';
import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';
import { ActorManager } from '../Core/ActorManager';

import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { MasterModels } from '../Models/MasterModels';
import { ActorConfigManager } from '../Core/ActorConfigManager';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let actorManager:ActorManager;
    let actorConfigManager:ActorConfigManager;


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
            ActorManager,
            ActorConfigManager,
        ],
        }).compile();
        config = app.get<Config>(Config);
        await config.loadConfig()
        redisManager = app.get<RedisManager>(RedisManager);

        let masterModels = app.get<MasterModels>(MasterModels);
        await masterModels.register()

        await redisManager.flushAllDb();

        
        actorConfigManager = app.get<ActorConfigManager>(ActorConfigManager);
        await actorConfigManager.saveConfigFileToMasterRedis()

        actorManager = app.get<ActorManager>(ActorManager);
        
        
        
    });

    afterEach(async()=>{
        await redisManager.closeAll();
    })
    

  


    describe('.client config', () => {

        it('.broadcast_listeners to db', async () => {
            let userActorConfig = await actorConfigManager.getByName('user');
            let contentActorConfig = await actorConfigManager.getByName('content');
            mock.onPost(userActorConfig.api).replyOnce(200,{
                'actor_name':'user',
                "broadcast_listeners": [{
                    "processor": "Tests\\Services\\ContentUpdateListener",
                    "topic": "content@post.update",
                    "condition": null
                }]
            })
            mock.onPost(contentActorConfig.api).replyOnce(200,{
                'actor_name':'content',
                "broadcast_listeners": [{
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                    "condition": null
                }]
            })
           
            // await actorConfigManager.loadRemoteActorsConfig()
            await actorManager.bootstrap(false);
            let userActor = actorManager.get('user');
            let contentActor = actorManager.get('content');
            await userActor.loadRemoteConfig();
            await contentActor.loadRemoteConfig();
            
            let listenerModels = await actorConfigManager.masterModels.ListenerModel.find({});
            expect(listenerModels.length).toBe(2);//确认添加成功

            let newTopic = 'content@post.update_new';
            mock.onPost(userActorConfig.api).replyOnce(200,{
                'actor_name':'user',
                "broadcast_listeners": [{
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
            mock.onPost(contentActorConfig.api).replyOnce(200,{
                'actor_name':'content',
                "broadcast_listeners": []
            })

            await userActor.loadRemoteConfig();
            await contentActor.loadRemoteConfig();

            let userListeners = await actorConfigManager.masterModels.ListenerModel.findAndLoad({'actor_id':userActorConfig.id});
            expect(userListeners.length).toBe(2);//修改一个，添加一个，一个两个
            expect(userListeners[0].property('topic')).toBe(newTopic);//修改是否成功

            let contentListeners = await actorConfigManager.masterModels.ListenerModel.findAndLoad({'actor_id':contentActorConfig.id});
            expect(contentListeners.length).toBe(0); //是否删除

        });

    });

   
});
