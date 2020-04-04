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
import { MasterNohm } from '../Bootstrap';
import { MasterModels } from '../Models/MasterModels';
import { services } from '../app.module';
import { async } from 'rxjs/internal/scheduler/async';
import { BroadcastMessage } from '../Core/Messages/BroadcastMessage';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('BroadcastMessage', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterNohm,
            MasterModels,
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
        await actorManager.closeActors();
        await redisManager.quitAllDb();
    })
    

  


    describe('.create:', async () => {


        it('.add by broadcast message',async (done)=>{
            let producerName = 'user';
            let topic = 'user.update';
            let message:TransactionMessage;
            let userProducer = actorManager.get(producerName);
            let contentProducer = actorManager.get('content');
            let updatedMessage:BroadcastMessage;


            mock.onPost(config.actors.get(1).api).replyOnce(200,{
                "listeners": [{
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
            mock.onPost(config.actors.get(2).api).replyOnce(200,{
                "listeners": []
            })
 
            await actorManager.loadActorsRemoteConfig()
            process.env.SUBTASK_JOB_DELAY = '100';
            message = await messageService.create(producerName,MessageType.BROADCAST,topic,{
                delay:0,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 5000
                }
            });

            mock.onPost(userProducer.api).replyOnce(200,{message:'subtask process succeed'})

            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await userProducer.messageManager.get(message.id);


                let listenerSubtasks = (await updatedMessage.loadListenerSubtasks()).listenerSubtasks;

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                }
       
                if(listenerSubtasks[0].job_id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    expect(updatedMessage.pending_subtask_total).toBe(0)
                    done()
                }
            })



            await actorManager.bootstrapActorsCoordinatorprocessor();
        })


        it('.add by transaction bcst', async (done) => {
            let producerName = 'user';
            let topic = 'user.update';
            let message:TransactionMessage;
            let userProducer = actorManager.get(producerName);
            let contentProducer = actorManager.get('content');
            let updatedMessage:TransactionMessage;
            mock.onPost(config.actors.get(1).api).replyOnce(200,{
                "listeners": [{
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
            mock.onPost(config.actors.get(2).api).replyOnce(200,{
                "listeners": [{
                    "processor": "Tests\\Services\\UserUpdateListener",
                    "topic": "user@user.update",
                    "condition": null
                }]
            })
            await actorManager.loadActorsRemoteConfig()
            message = await messageService.create(producerName,MessageType.TRANSACTION,topic,{
                delay:0,
                attempts:5,
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
                let bcstSubtask:BcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                let broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                let listenerSubtasks = (await broadcastMessage.loadListenerSubtasks()).listenerSubtasks;
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
                let bcstSubtask:BcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                let broadcastMessage = (await bcstSubtask.loadBroadcastMessage()).broadcastMessage;
                let listenerSubtasks = (await broadcastMessage.loadListenerSubtasks()).listenerSubtasks;
                
                if(listenerSubtasks.length > 0 && listenerSubtasks[1].job_id == job.id){
                    console.log('contentProducer',job.id)
                    listenerDoneCount++
                    if(listenerDoneCount == 2)doneExpect(done,updatedMessage,broadcastMessage);
                }

            })
            await actorManager.bootstrapActorsCoordinatorprocessor();


            await message.confirm();

        });

       

    });



});