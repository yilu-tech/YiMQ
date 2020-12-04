import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';
import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { join } from 'path';

import { ActorManager } from '../../Core/ActorManager';
import { services } from '../../app.module';
import { MessageService } from '../../Services/MessageService';
import { MessageType, MessageStatus } from '../../Constants/MessageConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../../Constants/SubtaskConstants';
import { EcSubtask } from '../../Core/Subtask/EcSubtask';
import { TccSubtask } from '../../Core/Subtask/TccSubtask';
import { JobService } from '../../Services/JobService';
import { MasterModels } from '../../Models/MasterModels';
import { Application } from '../../Application';
import { ActorConfigManager } from '../../Core/ActorConfigManager';
import { ContextLogger } from '../../Handlers/ContextLogger';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let jobService:JobService
    let actorManager:ActorManager;


    beforeAll(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'../','config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
            ActorConfigManager,
            ActorManager,
            Application,
            ContextLogger,
            ...services,
        ],
        }).compile();
        config = app.get<Config>(Config);
        await config.loadConfig();

        redisManager = app.get<RedisManager>(RedisManager);
        await redisManager.flushAllDb();

        let application = app.get<Application>(Application);
        await application.baseBootstrap()


        actorService = app.get<ActorService>(ActorService);


        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        jobService = app.get<JobService>(JobService);
        actorManager = app.get<ActorManager>(ActorManager);
        await actorManager.bootstrap(false)
        
    });

    afterAll(async()=>{
        await actorManager.shutdown();
        await redisManager.closeAll();
    
    })

    describe('.create:', () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


        it('.add ec tcc subtask1', async () => {
            let contentActor = actorManager.get('content'); 
            let producer = actorManager.get(producerName);
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:'content@post.create',
                title: 'new post'
            })
             
            mock.onPost(contentActor.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:'content@post.create',
                title: 'new post'
            })
            
        });


        it('.add ec tcc subtask1', async () => {

            let producer = actorManager.get(producerName);
            let contentActor = actorManager.get('content'); 
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:'content@post.create',
                title: 'new post'
            })
             
            mock.onPost(contentActor.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:'content@post.create',
                title: 'new post'
            })
        });

        it('.job list', async () => {
            await jobService.list(1);
        });




    });

});
