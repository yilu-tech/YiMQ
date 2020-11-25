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
        
    });

    afterEach(async()=>{
        await actorManager.shutdown();
        await redisManager.closeAll();
    })
    

  


    describe('.create:',() => {


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
                    "topic": "user@user.update",
                    "condition": null
                }]
            })
            mock.onPost(contentActorConfig.api).replyOnce(200,{
                "actor_name": 'content',
                "broadcast_listeners": []
            })
 
            // await actorConfigManager.loadRemoteActorsConfig()
            // await actorManager.initActors()
            await actorManager.bootstrap(false);

            let userProducer = actorManager.get(producerName);
            let contentProducer = actorManager.get('content');
            await userProducer.prepare();
            await contentProducer.prepare();

            process.env.SUBTASK_JOB_DELAY = '100';
            message = await messageService.create(producerName,MessageType.BROADCAST,topic,{},{
                delay:1000,
                // attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 5000
                }
            });

            mock.onPost(userProducer.api).replyOnce(200,{message:'subtask process succeed'})

            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await userProducer.messageManager.get(message.id);


                let subtasks = (await updatedMessage.loadSubtasks()).subtasks;

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                }
       
                if(subtasks[0].job_id == job.id){
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


            await actorManager.bootstrap(false);


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
            process.env.SUBTASK_JOB_DELAY = '100';
            let prepareResult = await messageService.prepare(producerName,message.id,body);
            mock.onPost(userProducer.api).reply(200,{message:'subtask process succeed'})
            mock.onPost(contentProducer.api).reply(200,{message:'subtask process succeed'})


            let listenerDoneCount = 0;
            function doneExpect(done,updatedMessage,broadcastMessage){
                expect(broadcastMessage.status).toBe(MessageStatus.DONE)
                expect(broadcastMessage.pending_subtask_total).toBe(0)
                //检查message的状态
                expect(updatedMessage.status).toBe(MessageStatus.DONE)
                expect(updatedMessage.pending_subtask_total).toBe(0)
                    
                done();
            }
            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await userProducer.messageManager.get(message.id);
                await updatedMessage.loadSubtasks();
                let bcstSubtask:BcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                let broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                let listenerSubtasks = (await broadcastMessage.loadSubtasks()).subtasks;
                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING);
                }

                if(broadcastMessage.job_id == job.id){
                    expect(broadcastMessage.status).toBe(MessageStatus.DOING)  
                }

                if(listenerSubtasks.length > 0 && listenerSubtasks[0].job_id == job.id){
                    console.log('userProducer job_id',job.id)
                    listenerDoneCount++
                    if(listenerDoneCount == 2)doneExpect(done,updatedMessage,broadcastMessage);
                }
            })

            contentProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await userProducer.messageManager.get(message.id);
                await updatedMessage.loadSubtasks();
                let bcstSubtask:BcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                let broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                let listenerSubtasks = (await broadcastMessage.loadSubtasks()).subtasks;
                
                if(listenerSubtasks.length > 0 && listenerSubtasks[1].job_id == job.id){
                    console.log('contentProducer',job.id)
                    listenerDoneCount++
                    if(listenerDoneCount == 2)doneExpect(done,updatedMessage,broadcastMessage);
                }

            })
            // await actorManager.bootstrapActorsCoordinatorprocessor();
            await userProducer.process();
            await contentProducer.process();


            await message.confirm();

        });

       

    });



});
