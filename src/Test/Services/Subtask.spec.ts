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
import { Message } from '../../Core/Messages/Message';
import { JobAction } from '../../Constants/JobConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { RedisClient } from 'src/Handlers/redis/RedisClient';
import {JobStatus} from '../../Constants/JobConstants'
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { SubtaskType } from '../../Constants/SubtaskConstants';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;
    let redisClient:RedisClient;

    beforeEach(async () => {
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
        redisClient = await redisManager.client();
        await redisClient.flushdb();
        actorService = app.get<ActorService>(ActorService);
        await actorService.loadConfigFileToMasterRedis();

        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        actorManager = app.get<ActorManager>(ActorManager);
        
        await actorManager.initActors();
    });

    afterEach(async()=>{
        await redisClient.quit();//todo::应该开发一个MQ.quit();
        await actorManager.closeActors();
    })
    

  


    describe('.create', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:TransactionMessage;


        it('.create ec', async () => {

           
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let producer = actorManager.get(producerName); 

            //创建EC
            let target = 'content@post.change';
            await message.addSubtask(SubtaskType.EC,target,{'name':1});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.getSubtask(1).processer).toBe(target);
            expect(updatedMessage.getSubtask(1).id).toBe(1);


        });

        it('.create tcc', async () => {

           
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let processerName = 'content@post.create';
            let producer = actorManager.get(producerName); 
            await message.addSubtask(SubtaskType.TCC,processerName,{'name':1});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.getSubtask(1).type).toBe(SubtaskType.TCC);

        });

        // it('.after cancel', async (done) => {
        //     let producerName = 'user';
        //     let messageType = MessageType.TRANSACTION;
        //     let topic = 'user_create';
        //     let message:Message;
           
        //     message = await messageService.create(producerName,messageType,topic,{
        //         delay:300,
        //         attempts:5,
        //         backoff:{
        //             type:'exponential',
        //             delay: 100  
        //         }
        //     });
        //     expect(message.status).toBe(MessageStatus.PENDING)
        //     let producer = actorManager.get(producerName); 
        //     //message确认后，移除message的检测job
        //     producer.coordinator.getQueue().on('completed',async (job)=>{
        //         if(message.job.id == job.id){
        //             expect(message.status).toBe(MessageStatus.CANCELLING)
        //             done()
        //         }
        //     })
        //     await actorManager.bootstrapActorsCoordinatorProcesser();
        //     message = await messageService.cancel(producerName,message.id);
        // });
    });

});
