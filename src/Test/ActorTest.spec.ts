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
    let actorConfigManager:ActorConfigManager;


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
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
        
        
        
    });

    afterEach(async()=>{
        await redisManager.quitAllDb();
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
           
            await actorConfigManager.loadRemoteActorsConfig()
            
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
            await actorConfigManager.loadRemoteActorsConfig()
            let userListeners = await actorConfigManager.masterModels.ListenerModel.findAndLoad({'actor_id':userActorConfig.id});
            expect(userListeners.length).toBe(2);//修改一个，添加一个，一个两个
            expect(userListeners[0].property('topic')).toBe(newTopic);//修改是否成功

            let contentListeners = await actorConfigManager.masterModels.ListenerModel.findAndLoad({'actor_id':contentActorConfig.id});
            expect(contentListeners.length).toBe(0); //是否删除

        });

    });

   
});
