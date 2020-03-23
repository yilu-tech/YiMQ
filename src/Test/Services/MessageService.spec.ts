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
import { MessageType, MessageStatus, ActorMessageStatus } from '../../Constants/MessageConstants';
import { Message } from '../../Core/Messages/Message';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
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
        await redisManager.flushAllDb();
        actorService = app.get<ActorService>(ActorService);
        await actorService.loadConfigFileToMasterRedis();

        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        actorManager = app.get<ActorManager>(ActorManager);
        
        await actorManager.initActors();
    });

    afterEach(async()=>{
        await redisManager.quitAllDb();
        await actorManager.closeActors();
    })
    


    describe('.confirm', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        it('.after confirm', async (done) => {

            message = await messageService.create(producerName,messageType,topic,{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
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
                    let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

            let result = await messageService.confirm(producerName,message.id);
            console.log('--->',result)
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
        });

        it('.remote status pending after done', async (done) => {
            process.env.TRANSACATION_MESSAGE_JOB_DELAY = '100';
            message = await messageService.create(producerName,messageType,topic,{
                delay:50,
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
                let updatedMessage = await producer.messageManager.get(message.id);
                if(message.job.id == job.id && job.attemptsMade == 1){//第一次获取失败
                    expect(job.opts.delay).toBe(Number(process.env.TRANSACATION_MESSAGE_JOB_DELAY));
                    expect(job.attemptsMade).toBe(1)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.PENDING
                    })
                    expect(await message.job.context.getState()).toBe(JobStatus.DELAYED)
                    
                    expect(updatedMessage.status).toBe(MessageStatus.PENDING)
                }
                else if(message.job.id == job.id && job.attemptsMade == 2){//第二次尝试获取状态返回已完成
                    expect(job.attemptsMade).toBe(2)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.DONE
                    })
                    expect(await message.job.context.getState()).toBe(JobStatus.DELAYED)
                    expect(updatedMessage.status).toBe(MessageStatus.PENDING)
                }
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.attemptsMade).toBe(2);
                    expect(await message.job.context.getState()).toBe(JobStatus.COMPLETED)
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
        });

        it('.other db actor confirm test', async (done) => {
            let producerName = 'content';
            let messageType = MessageType.TRANSACTION;
            let topic = 'posts_create';
            let message:Message;
            process.env.TRANSACATION_MESSAGE_JOB_DELAY = '100';
            message = await messageService.create(producerName,messageType,topic,{
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: ActorMessageStatus.DONE
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });


    })

    describe('.cancel', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        it('.manual cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:8000,
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
                    let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);
        });

        it('.timeout check cancel', async (done) => {
            process.env.TRANSACATION_MESSAGE_JOB_DELAY = '100';
            message = await messageService.create(producerName,messageType,topic,{
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
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
        });


        it('.timeout check cancel after manual cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let producer = actorManager.get(producerName); 
            mock.onPost(producer.api).reply(200,{
                status:ActorMessageStatus.CANCELED
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    let result = await updatedMessage.cancel()
                    expect(result.message).toBe(`Message already ${MessageStatus.CANCELED}.`)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });
    });


});
