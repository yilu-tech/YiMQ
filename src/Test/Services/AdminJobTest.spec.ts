import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';
import { MasterNohm } from '../../Bootstrap/MasterNohm';
import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { join } from 'path';
import { modelsInjects} from '../../app.module';
import { ActorManager } from '../../Core/ActorManager';
import { services } from '../../Services';
import { MessageService } from '../../Services/MessageService';
import { MessageType, MessageStatus } from '../../Constants/MessageConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../../Constants/SubtaskConstants';
import { EcSubtask } from '../../Core/Subtask/EcSubtask';
import { TccSubtask } from '../../Core/Subtask/TccSubtask';
import { JobService } from '../../Services/JobService';
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
        messageService = app.get<MessageService>(MessageService);
        jobService = app.get<JobService>(JobService);
        actorManager = app.get<ActorManager>(ActorManager);
        
        await actorManager.initActors();
    });

    afterAll(async()=>{
        await redisManager.quitAllDb();
        await actorManager.closeActors();
    })

    describe('.create:', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


        it('.add ec tcc subtask1', async () => {

            let producer = actorManager.get(producerName);
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,SubtaskType.EC,producerName,{
                title: 'new post'
            })
             
            mock.onPost(producer.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,producerName,{
                title: 'new post'
            })
            
        });


        it('.add ec tcc subtask1', async () => {

            let producer = actorManager.get(producerName);
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,SubtaskType.EC,producerName,{
                title: 'new post'
            })
             
            mock.onPost(producer.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,producerName,{
                title: 'new post'
            })
        });

        it('.job list', async () => {
            await jobService.list(1);
        });




    });

});