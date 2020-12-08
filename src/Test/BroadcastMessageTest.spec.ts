import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';

import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';

import { ActorManager } from '../Core/ActorManager';

import { MessageService } from '../Services/MessageService';
import { MessageType, MessageStatus } from '../Constants/MessageConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../Constants/SubtaskConstants';
import { BcstSubtask } from '../Core/Subtask/BcstSubtask';
import { MasterModels } from '../Models/MasterModels';
import { services } from '../app.module';
import { async } from 'rxjs/internal/scheduler/async';
import { BroadcastMessage } from '../Core/Messages/BroadcastMessage';
import { Application } from '../Application';
import { ActorConfigManager } from '../Core/ActorConfigManager';
import { ContextLogger } from '../Handlers/ContextLogger';
import { Actor } from '../Core/Actor';
import { MessagesDto } from '../Dto/AdminControllerDto';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('BroadcastMessage', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;
    let application:Application;
    let actorConfigManager:ActorConfigManager;

    let userActor:Actor;

    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
            Application,
            ContextLogger,
            ActorConfigManager,
            ActorManager,
            ...services,
        ],
        }).compile();
        config = app.get<Config>(Config);
        await config.loadConfig();

        redisManager = app.get<RedisManager>(RedisManager);
        await redisManager.flushAllDb();

        application = app.get<Application>(Application);
        await application.baseBootstrap()


        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        actorConfigManager = app.get<ActorConfigManager>(ActorConfigManager);
        actorManager = app.get<ActorManager>(ActorManager);
        await actorManager.bootstrap(false); //这行必须beforeEach启动
        mock.reset()

        userActor = actorManager.get('user');
        
    });

    afterEach(async()=>{
        await actorManager.shutdown();
        await redisManager.closeAll();
    })
    

  


    describe('.create:',() => {

        it('.add by message listener total 0',async ()=>{

            let message = <BroadcastMessage>await userActor.messageManager.create(MessageType.BROADCAST,'test',{data:'test'},{})
            expect(message.status).toBe(MessageStatus.DOING);

            let result = await message.toDoing();
            expect(result.desc).toBe('Not have listeners.');

            let updatedMessage = <BroadcastMessage> await userActor.messageManager.get(message.id);

            expect(updatedMessage.status).toBe(MessageStatus.DONE);
            let conditions = <MessagesDto>{
                actor_id:userActor.id,
                status:[MessageStatus.DONE],
                start:0,
                size:100
            }
            let searchResult = await messageService.search(userActor.id,conditions)
            expect(searchResult.total).toBe(1);
  

        })

        it('add by bcst listener total 0',async ()=>{

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'test',{data:'test'},{})
            // expect(message.status).toBe(MessageStatus.DOING);

            let bcstSubtask = <BcstSubtask>await message.addSubtask(SubtaskType.BCST,{
                topic: 'user.update'
            })
            await message.confirm();
            await message.toDoing();

            bcstSubtask = await userActor.subtaskManager.get(bcstSubtask.id);
            await bcstSubtask.loadBroadcastMessage();
            let bcstMessage = bcstSubtask.broadcastMessage;


            expect(bcstMessage.status).toBe(MessageStatus.DOING);
            expect(await bcstSubtask.getStatus()).toBe(SubtaskStatus.DOING);
            expect(await message.getStatus()).toBe(MessageStatus.DOING)

            await bcstMessage.toDoing();

            expect(await bcstMessage.getStatus()).toBe(MessageStatus.DONE);
            expect(await bcstSubtask.getStatus()).toBe(SubtaskStatus.DONE);
            expect(await message.getStatus()).toBe(MessageStatus.DONE)

        })

        it('.add by broadcast message',async (done)=>{

            let producerName = 'user';
            let topic = 'user.update';
            let message:TransactionMessage;
            let updatedMessage:BroadcastMessage;

            let userActorConfig = await actorConfigManager.getByName('user');
            let contentActorConfig = await actorConfigManager.getByName('content');
            mock.onPost(userActorConfig.api).replyOnce(200,{
                "actor_name": 'user',
                "broadcast_listeners": [{
                    "processor": "Tests\\Services\\ContentUpdateListener",
                    "topic": "content@post.update",
                    "condition": null
                },
                {
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": `user@${topic}`,
                    "condition": null
                }]
            })
            mock.onPost(contentActorConfig.api).replyOnce(200,{
                "actor_name": 'content',
                "broadcast_listeners": []
            })
 
            // await actorConfigManager.loadRemoteActorsConfig()
            // await actorManager.initActors()


            let userProducer = actorManager.get(producerName);
            let contentProducer = actorManager.get('content');
            await userProducer.prepare();
            await contentProducer.prepare();

            message = await messageService.create(producerName,MessageType.BROADCAST,topic,{},{
                delay:1000,
                // attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 5000
                }
            });

            mock.onPost(userProducer.api).replyOnce(async()=>{
                await timeout(100);
                return [200,{message:'subtask process succeed'}]
            })

            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = <BroadcastMessage>await userProducer.messageManager.get(message.id);


                let subtasks = (await updatedMessage.loadSubtasks()).subtasks;

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                }
       
                if(subtasks[0]['job_id'] == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    expect(updatedMessage.pending_subtask_total).toBe(0)
                    done()
                }
            })



            // await actorManager.bootstrapActorsCoordinatorprocessor();
           
            await userProducer.process();
            await contentProducer.process();
        })


        it('.add by transaction bcst', async (done) => {
            let producerName = 'user';
            let topic = 'user.update';
            let message:TransactionMessage;
            let updatedMessage:TransactionMessage;

            let userActorConfig = await actorConfigManager.getByName('user');
            let contentActorConfig = await actorConfigManager.getByName('content');
            mock.onPost(userActorConfig.api).replyOnce(200,{
                "actor_name": 'user',
                "broadcast_listeners": [{
                    "processor": "Tests\\Services\\ContentUpdateListener",
                    "topic": "content@post.update",
                    "condition": null
                },
                {
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                    "condition": null
                }
            ]
            })
            mock.onPost(contentActorConfig.api).replyOnce(200,{
                "actor_name": 'content',
                "broadcast_listeners": [{
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                    "condition": null
                }]
            })


            


            let userProducer = actorManager.get(producerName);
            let contentProducer = actorManager.get('content');
            await userProducer.prepare();
            await contentProducer.prepare();

            message = await messageService.create(producerName,MessageType.TRANSACTION,topic,{},{
                delay:1000,
                backoff:{
                    type:'exponential',
                    delay: 5000
                }
            });

            let body = {
                prepare_subtasks:[
                    {
                        type:'BCST',
                        topic:'user.update',
                        data:{'title':'test'}
                    }
                ]
            }

            await messageService.prepare(producerName,message.id,body);
            mock.onPost(userProducer.api).replyOnce(async()=>{
                await timeout(200);//需要延迟，否则检查message doning态无法检查
                return [200,,{message:'subtask process succeed user'}];
            })
            mock.onPost(contentProducer.api).replyOnce(200,{message:'subtask process succeed content'})


            let listenerDoneCount = 0;
            function doneExpect(done,updatedMessage,broadcastMessage,bcstSubtask:BcstSubtask){
                expect(broadcastMessage.status).toBe(MessageStatus.DONE)
                expect(broadcastMessage.pending_subtask_total).toBe(0)
                //检查message的状态
                expect(updatedMessage.status).toBe(MessageStatus.DONE)
                expect(updatedMessage.pending_subtask_total).toBe(0)
                expect(bcstSubtask.status).toBe(SubtaskStatus.DONE)
                    
                done();
            }
            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = <TransactionMessage> await userProducer.messageManager.get(message.id);
                await updatedMessage.loadSubtasks();
             
                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING);
                }

                let bcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];

                if(bcstSubtask){
                    var broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                    var listenerSubtasks = (await broadcastMessage.loadSubtasks()).subtasks;

                    if(broadcastMessage.job_id == job.id){
                        expect(broadcastMessage.status).toBe(MessageStatus.DOING)  
                    }
    
                    if(listenerSubtasks.length > 0 && listenerSubtasks[0]['job_id'] == job.id){
                        // console.log('userProducer job_id',job.id)
                        expect(await listenerSubtasks[0].getStatus()).toBe(SubtaskStatus.DONE)
                        listenerDoneCount++
                        if(listenerDoneCount == 2)doneExpect(done,updatedMessage,broadcastMessage,bcstSubtask);
                    }
                }

                
            })

            contentProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage =<TransactionMessage> await userProducer.messageManager.get(message.id);
                await updatedMessage.loadSubtasks();

                let bcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                if(bcstSubtask){
                    let broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                    let listenerSubtasks = (await broadcastMessage.loadSubtasks()).subtasks;
                    if(listenerSubtasks.length > 0 && listenerSubtasks[1]['job_id'] == job.id){
                        // console.log('contentProducer',job.id)
                        expect(await listenerSubtasks[1].getStatus()).toBe(SubtaskStatus.DONE)
                        listenerDoneCount++
                        if(listenerDoneCount == 2)doneExpect(done,updatedMessage,broadcastMessage,bcstSubtask);
                    }

                }

            })
            // await actorManager.bootstrapActorsCoordinatorprocessor();
            await userProducer.process();
            await contentProducer.process();


            await message.confirm();

        });

       

    });

    describe('.abnormal transaction',() => {


        it('.create listeners failed after retry',async ()=>{
            await actorManager.bootstrap(false);

            config.options.broadcast_message_delay = 1000;

            let userActor = actorManager.get('user');
            let userListenerOption = {
                "processor": "Tests\\User\\Services\\UserUpdateListener",
                "topic": `user@user.update`,
                "condition": null
            }
            await actorConfigManager.saveOrUpdateListener(userActor,userListenerOption);

            let contentActor = actorManager.get('content');
            let contentListenerOption = {
                "processor": "Tests\\Content\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                "condition": null
            }
            await actorConfigManager.saveOrUpdateListener(contentActor,contentListenerOption);

            let message = await userActor.messageManager.create(MessageType.BROADCAST,'user.update',{data:'test'},{});


            await message.job.process()
            let subtask_ids = await userActor.subtaskModel.find({message_id: message.id});
            expect(subtask_ids.length).toBe(2);
            
            let jobConuts = await userActor.coordinator.getJobConuts()

            expect(jobConuts.waiting).toBe(1);

            await message.job.process()
            subtask_ids = await userActor.subtaskModel.find({message_id: message.id});

            expect(subtask_ids.length).toBe(2);
            jobConuts = await userActor.coordinator.getJobConuts()
            expect(jobConuts.waiting).toBe(1);
            
            expect(1).toBe(1)


        })

    })



});
