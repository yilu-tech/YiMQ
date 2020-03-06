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
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('MessageService', () => {
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
    

    /**
     * 错误后，通过检查状态，校正任务完成
     */
    describe('create transaction message timeout check status by remote', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;
        
        it('.remote status pending after done', async (done) => {
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:100,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 
            //模拟500错误
            mock.onPost(producer.api).reply(500,{

            })

            producer.coordinator.getQueue().on('failed',async (job)=>{
                
                if(message.job.id == job.id && job.attemptsMade == 1){//第一次获取失败
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(1)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.PENDING
                    })
                    expect(await message.job.context.getState()).toBe(JobStatus.DELAYED)
                }
                else if(message.job.id == job.id && job.attemptsMade == 2){//第二次尝试获取状态返回已完成
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(2)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.DONE
                    })
                    expect(await message.job.context.getState()).toBe(JobStatus.DELAYED)
                }
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(2);
                    expect(await message.job.context.getState()).toBe(JobStatus.COMPLETED)
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });


        it('.status cancel', async (done) => {
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:100,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: MessageStatus.CANCELED
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });

        it('.status done on db2', async (done) => {
            let producerName = 'content';
            let messageType = MessageType.TRANSACTION;
            let topic = 'posts_create';
            let message:Message;
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:100,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: MessageStatus.DONE
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();

        });


    });


    describe('create transaction message', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;


        it('.after confirm', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
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

            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(message.status).toBe(MessageStatus.DOING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();

            message = await messageService.confirm(producerName,message.id);
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
        });

        it('.after cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
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
            //message确认后，移除message的检测job
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(message.status).toBe(MessageStatus.CANCELLING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
            message = await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);
        });
    });

});
