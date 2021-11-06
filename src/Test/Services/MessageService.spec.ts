import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';

import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { join } from 'path';
import { MasterModels } from '../../Models/MasterModels';
import { ActorManager } from '../../Core/ActorManager';
import { services } from '../../app.module';
import { MessageService } from '../../Services/MessageService';
import { MessageType, MessageStatus, ActorMessageStatus } from '../../Constants/MessageConstants';
import { Message } from '../../Core/Messages/Message';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {JobStatus} from '../../Constants/JobConstants'
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { Application } from '../../Application';
import { ActorConfigManager } from '../../Core/ActorConfigManager';
import { ContextLogger } from '../../Handlers/ContextLogger';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { XaSubtask } from '../../Core/Subtask/XaSubtask';
import { MessageJob } from '../../Core/Job/MessageJob';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('MessageService', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;
    let application:Application

    beforeEach(async () => {
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

        application = app.get<Application>(Application);
        await application.baseBootstrap()


        actorService = app.get<ActorService>(ActorService);

        
        messageService = app.get<MessageService>(MessageService);
        actorManager = app.get<ActorManager>(ActorManager);
        await actorManager.bootstrap(false)
    });

    afterEach(async()=>{
    
        await actorManager.shutdown();
        await redisManager.closeAll();
        mock.reset();

    })

    describe('.prepared', () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        it('.prepared after confirm', async (done) => {

            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
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

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);

            let result = await messageService.confirm(producerName,message.id);
            updatedMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
        });

        it('.prepared after cancel', async (done) => {

            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let producer = actorManager.get(producerName); 

            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);

            let result = await messageService.cancel(producerName,message.id);
            updatedMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);
        });

        it('.prepared after prepare', async () => {

            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let producer = actorManager.get(producerName); 

    

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);

            await expect(messageService.prepare(producerName,message.id,{})).rejects.toThrow('The status of this message is PREPARED instead of PENDING');
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);
            
        });

        it('.prepared after add subtask', async () => {
            let userActor = actorManager.get('user');
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let producer = actorManager.get(producerName); 

    

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);
       

            await expect(updatedMessage.addSubtask(SubtaskType.XA,{
                processor:'user@user.create',
                data:{
                    'name':1
                }
            })).rejects.toThrow('The status of this message is PREPARED instead of PENDING');
            
        });

        it('.prepared  after timeout check done', async (done) => {
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 100;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);
           

            mock.onPost(producer.api).reply(200,{
                status: MessageStatus.DONE
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            await producer.process();
            await messageService.prepare(producerName,message.id,{});
        });

        it('.prepared  after timeout check cancel', async (done) => {
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 100;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);


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
            await producer.process();
            await messageService.prepare(producerName,message.id,{});
        });
        

    })
    


    describe('.confirm', () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        it('.after confirm', async (done) => {

            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000, //设置超过5秒，检查confirm后是否立即执行job
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

            await producer.process();

            let result = await messageService.confirm(producerName,message.id);
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
        });

        it('.cancel after confirm',async (done) => {
            let userActor = actorManager.get('user');
            let message:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{delay:5000});
            userActor.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    //process后
                    let updatedMessage:TransactionMessage = await userActor.messageManager.get(message.id);
                    await expect(updatedMessage.confirm()).rejects.toThrow(`The status of this message is ${MessageStatus.CANCELED}.`)
                    done()
                }
            })
            
            
            await message.cancel();
            expect(await message.getStatus()).toBe(MessageStatus.CANCELLING)
            
            //未process前    (需要重新查询一次message，否则状态未更新)
            let updatedMessage:TransactionMessage = await userActor.messageManager.get(message.id);
            await expect(updatedMessage.confirm()).rejects.toThrow(`The status of this message is ${MessageStatus.CANCELLING}.`)
            await userActor.process();
        })

        it('.remote status pending after done', async (done) => {
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 0;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:50,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);

            //模拟500错误
            mock.onPost(producer.api).reply(500,{

            })

            producer.coordinator.getQueue().on('failed',async (job)=>{
                let updatedMessage = await producer.messageManager.get(message.id);
                if(message.job.id == job.id && job.attemptsMade == 1){//第一次获取失败
                    expect(job.opts.delay).toBe(50);
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
            await producer.process();
        });

        it('.other db actor confirm test', async (done) => {
            let producerName = 'content';
            let messageType = MessageType.TRANSACTION;
            let topic = 'posts_create';
            let message:Message;
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 100;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);


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
            await producer.process();

        });


    })

    describe('.cancel', () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        it('.manual cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:8000
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
            await producer.process();
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);
        });

        it('.confirm after cancel',async (done) => {
            let userActor = actorManager.get('user');
            let message:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{delay:5000});
            userActor.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    //process后
                    let updatedMessage:TransactionMessage = await userActor.messageManager.get(message.id);
                    await expect(updatedMessage.cancel()).rejects.toThrow(`The status of this message is ${MessageStatus.DONE}.`)
                    done()
                }
            })
            
            
            await message.confirm();
            expect(await message.getStatus()).toBe(MessageStatus.DOING)
            
            //未process前    (需要重新查询一次message，否则状态未更新)
            let updatedMessage:TransactionMessage = await userActor.messageManager.get(message.id);
            await expect(updatedMessage.cancel()).rejects.toThrow(`The status of this message is ${MessageStatus.DOING}.`)
            await userActor.process();
        })

        it('.timeout check cancel', async (done) => {
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 100;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);
            

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
            await producer.process();
        });

        it('.timeout check message not exist to cancel',async()=>{
            let producer = actorManager.get(producerName); 

            
            let message = <TransactionMessage>await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            await message.loadJob();
            mock.onPost(producer.api).reply(500,{
                message:'Message not exists.'
            })

            producer.options.message_check_not_exist_ignore = true

            let messageJob = new MessageJob(message,message.job.context)
            await messageJob.process()
            await message.refresh()
            expect(message.status).toBe(MessageStatus.CANCELED)
        })


        it('.timeout check cancel after manual cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
            let producer = actorManager.get(producerName); 
            producer.options.message_check_min_delay = 0;
           
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
            });
            expect(message.status).toBe(MessageStatus.PENDING)

           
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
            await producer.process();

        });
    });


    describe('.child message', () => {
        it('.child message create', async () => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let parentMessage:TransactionMessage;
            let childMessage1:TransactionMessage;
            let childMessage2:TransactionMessage;

            let userActor = actorManager.get('user');

            parentMessage = await messageService.create(producerName,messageType,topic,{},{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
            });
            mock.onPost(userActor.api).replyOnce(200);
            let subtask:XaSubtask = await parentMessage.addSubtask(SubtaskType.XA,{
                processor:'user@user.create',
                data:{
                    'name':1
                }
            });
            let parent_subtask = `${subtask.producer.name}@${subtask.id}`;
            childMessage1 = await messageService.create(producerName,messageType,topic,{},{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
                parent_subtask: parent_subtask
            });

            childMessage2 = await messageService.create(producerName,messageType,topic,{},{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
                parent_subtask: parent_subtask
            });

            expect(childMessage1.parent_subtask_id).toBe(subtask.id)
        })

    })



});
