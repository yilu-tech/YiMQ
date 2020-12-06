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
import { TccSubtask } from '../../Core/Subtask/TccSubtask';
import { OnDemandFastToJson } from '../../Decorators/OnDemand';
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
        mock.reset()
    });

    afterEach(async()=>{
    
        await actorManager.shutdown();
        await redisManager.closeAll();

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
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage = await producer.messageManager.get(message.id);
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
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })

            await producer.process();
            await messageService.prepare(producerName,message.id,{});
            let updatedMessage = await producer.messageManager.get(message.id);
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
            let updatedMessage = await producer.messageManager.get(message.id);
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
            let updatedMessage = <TransactionMessage>await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);
       

            await expect(updatedMessage.addSubtask(SubtaskType.XA,{
                processor:'user@user.create',
                data:{
                    'name':1
                }
            })).rejects.toThrow('The status of this message is PREPARED instead of PENDING');
            
        });

        it('.prepared  after timeout check done', async (done) => {
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

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
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
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
            await producer.process();
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })

            

            let result = await messageService.confirm(producerName,message.id);
            let updatedMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
        });

        it('.cancel after confirm',async (done) => {
            let userActor = actorManager.get('user');
            let message:TransactionMessage =  <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{delay:5000});
            await userActor.process();
            userActor.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    //process后
                    let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
                    await expect(updatedMessage.confirm()).rejects.toThrow(`The status of this message is ${MessageStatus.CANCELED}.`)
                    done()
                }
            })
            
            
            await message.cancel();
            expect(await message.getStatus()).toBe(MessageStatus.CANCELLING)
            
            //未process前    (需要重新查询一次message，否则状态未更新)
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await expect(updatedMessage.confirm()).rejects.toThrow(`The status of this message is ${MessageStatus.CANCELLING}.`)
            
        })

        it('.remote status pending after done', async (done) => {
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100,
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
            await producer.process();
            producer.coordinator.on('failed',async (job)=>{
                let updatedMessage = await producer.messageManager.get(message.id);
                if(message.job.id == job.id && job.attemptsMade == 1){//第一次获取失败
                    expect(job.opts.delay).toBe(100);
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
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.attemptsMade).toBe(2);
                    expect(await message.job.context.getState()).toBe(JobStatus.COMPLETED)
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            
        });

        it('.other db actor confirm test', async (done) => {
            let producerName = 'content';
            let messageType = MessageType.TRANSACTION;
            let topic = 'posts_create';
            let message:Message;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100

            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: ActorMessageStatus.DONE
            })
            await producer.process();
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    done()
                }
            })
            

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
            await producer.process();
            //message确认后，移除message的检测job
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })
           
            await messageService.cancel(producerName,message.id);

            let updatedMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);
        });

        it('.confirm after cancel',async (done) => {
            let userActor = actorManager.get('user');
            let message:TransactionMessage = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{delay:5000});
            await userActor.process();
            userActor.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    //process后
                    let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
                    await expect(updatedMessage.cancel()).rejects.toThrow(`The status of this message is ${MessageStatus.DONE}.`)
                    done()
                }
            })
            
            
            await message.confirm();
            expect(await message.getStatus()).toBe(MessageStatus.DOING)
            
            //未process前    (需要重新查询一次message，否则状态未更新)
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await expect(updatedMessage.cancel()).rejects.toThrow(`The status of this message is ${MessageStatus.DOING}.`)
            
        })

        it('.timeout check cancel', async (done) => {
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:100
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: MessageStatus.CANCELED
            })
            await producer.process();
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })
            
        });


        it('.timeout check cancel after manual cancel', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'user_create';
            let message:Message;
           
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:1000, //设置超过5秒，检查confirm后是否立即执行job
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let producer = actorManager.get(producerName); 
            mock.onPost(producer.api).reply(200,{
                status:ActorMessageStatus.CANCELED
            })
            await producer.process();
            producer.coordinator.on('completed',async (job)=>{
                if(message.job.id == job.id){
                    let updatedMessage = <TransactionMessage>await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    let result = await updatedMessage.cancel()
                    expect(result.message).toBe(`Message already ${MessageStatus.CANCELED}.`)
                    done()
                }
            })
           

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


    describe('.message lock', () => {

        it('.add subtask long time after cancle message can not get lock', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'subtask_test';
            let message:TransactionMessage;
           
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let producer = actorManager.get(producerName);  
            let prepareResult = {title: 'get new user'};
            
            mock.onPost(producer.api,{
                asymmetricMatch:(actual)=>{
                    // console.log(actual)
                    return true;
                }
            }).replyOnce(async ()=>{//让subtask超时perpared
                await timeout(500)
                return [200,prepareResult];
            }) 

            mock.onPost(producer.api).replyOnce(async ()=>{//让subtask超时perpared
                return [200,{}];
            }) 

         
            process.env.MOCK_TODONG_TOCANCING_AFTER_LINK_SUBTASK_WAIT_TIME = '200';

            process.env.SUBTASK_JOB_BACKOFF_DELAY = '10';
            //没有await，让其在cancel之后再返回数据
            messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                },
                options:{
                    timeout:0
                }
            }).then(async (tccSubtask:TccSubtask)=>{
                expect(OnDemandFastToJson(tccSubtask)['prepareResult'].data.title).toBe(prepareResult.title);
            
                expect(await tccSubtask.getStatus()).toBe(SubtaskStatus.CANCELED);
                done()
            })  
        
            await messageService.cancel(producerName,message.id)// message cancle的时候，正在tcc try

            let updatedMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)
            
            await updatedMessage.loadJob()



            //如果这个时候去处理掉mesasge，应该要等待 subtask 添加到subtask_ids中
            await expect( updatedMessage.job.process()).rejects.toThrow('Message is locking can not to cancelling')

            //100毫秒
            await timeout(100);
             //重新查询

            updatedMessage = await producer.messageManager.get(message.id);
            await updatedMessage.loadJob();
            await updatedMessage.job.process()//再次处理message

            //重新查询
            updatedMessage = await producer.messageManager.get(message.id);
            await updatedMessage.loadSubtasks();


            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)

            let subtask = <TccSubtask> updatedMessage.subtasks[0];

            expect(subtask.status).toBe(SubtaskStatus.CANCELLING)
            await subtask.loadJob();
            await subtask.job.process()
            expect(subtask.status).toBe(SubtaskStatus.CANCELED)
            

        })



        it('.add subtask long time after done message can not get lock', async (done) => {
            let producerName = 'user';
            let messageType = MessageType.TRANSACTION;
            let topic = 'subtask_test';
            let message:TransactionMessage;
           
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let producer = actorManager.get(producerName);  
            let prepareResult = {title: 'get new user'};
            
            mock.onPost(producer.api,{
                asymmetricMatch:(actual)=>{
                    // console.log(actual)
                    return true;
                }
            }).replyOnce(async ()=>{//让subtask超时perpared
                await timeout(500)
                return [200,prepareResult];
            }) 


            mock.onPost(producer.api).replyOnce(async ()=>{//让subtask超时perpared
                return [200,{}];
            }) 

         
            process.env.MOCK_TODONG_TOCANCING_AFTER_LINK_SUBTASK_WAIT_TIME = '200';

            process.env.SUBTASK_JOB_BACKOFF_DELAY = '10';
            //没有await，让其在cancel之后再返回数据
            messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                },
                options:{
                    timeout:0
                }
            }).then(async (tccSubtask:TccSubtask)=>{
                expect(OnDemandFastToJson(tccSubtask)['prepareResult'].data.title).toBe(prepareResult.title);
            
                expect(await tccSubtask.getStatus()).toBe(SubtaskStatus.DONE);
                done()
            })  
        
            await messageService.confirm(producerName,message.id)// message cancle的时候，正在tcc try

            let updatedMessage = await producer.messageManager.get(message.id);
            await updatedMessage.loadJob()
            expect(updatedMessage.status).toBe(MessageStatus.DOING)
            
            



            //如果这个时候去处理掉mesasge，应该要等待 subtask 添加到subtask_ids中
            await expect( updatedMessage.job.process()).rejects.toThrow('Message is locking can not to to doing')

            //100毫秒
            await timeout(100);
            updatedMessage = await producer.messageManager.get(message.id);
            await updatedMessage.loadJob()
            await updatedMessage.job.process()//再次处理message


            updatedMessage = await producer.messageManager.get(message.id);
            await updatedMessage.loadSubtasks();

            expect(updatedMessage.status).toBe(MessageStatus.DOING)

            let subtask = <TccSubtask> updatedMessage.subtasks[0];

            expect(subtask.status).toBe(SubtaskStatus.DOING)
            await subtask.loadJob();
            await subtask.job.process()
            expect(subtask.status).toBe(SubtaskStatus.DONE)
            

        })

    })



});
