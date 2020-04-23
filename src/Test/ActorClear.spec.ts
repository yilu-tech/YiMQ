import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';

import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';
import { ActorManager } from '../Core/ActorManager';
import { MessageService } from '../Services/MessageService';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { MasterModels } from '../Models/MasterModels';
import { services } from '../app.module';
import { Application } from '../Application';
import { MessageStatus, MessageType } from '../Constants/MessageConstants';
import { EcSubtask } from '../Core/Subtask/EcSubtask';
import { SubtaskType, SubtaskStatus } from '../Constants/SubtaskConstants';
import { TccSubtask } from '../Core/Subtask/TccSubtask';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { Message } from '../Core/Messages/Message';
import { JobType, JobStatus } from '../Constants/JobConstants';
import { ActorConfigManager } from '../Core/ActorConfigManager';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('ActorClearTest', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;
    let application:Application


    beforeEach(async () => {
        process.env.CONFIG_DIR_PATH = join(__dirname,'config');
        
        const app: TestingModule = await Test.createTestingModule({
        controllers: [],
        providers: [
            Config,
            RedisManager,
            MasterModels,
            Application,
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
        actorManager = app.get<ActorManager>(ActorManager);
        await actorManager.initActors()
        
    });

    afterEach(async()=>{
        await actorManager.closeActors();
        await redisManager.quitAllDb();
    })
    

  


    describe('.success:',() => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


        it('.test by method',async ()=>{
            let producer = actorManager.get(producerName); 
            let contentActor = actorManager.get('content'); 
            let clear_interval = 300;
            
            producer.options.clear_interval = clear_interval;
            contentActor.options.clear_interval = clear_interval;
            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
        
           
            let contentProducer = actorManager.get('content'); 
            let prepareResult = {title: 'get new user'};
            mock.onPost(contentActor.api).replyOnce(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })          
            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })   


        


            //把message确认
            await messageService.confirm(producerName,message.id);

            await ecSubtask.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE)
            await tccSubtask.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE);



            let message2:TransactionMessage = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            // await message2.setStatus(MessageStatus.DONE).save()
            prepareResult = {title: 'get update user'};
            let message2ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message2.id,SubtaskType.EC,{
                processor:"content@user.create",
                data:{
                    username: 'jack'
                }
            })   
            message2ecSubtask.completeAndSetMeesageStatus(SubtaskStatus.DONE,MessageStatus.DONE)


            await timeout(clear_interval)
            //验证待删除message数量
            let doneMessageIds = await producer.actorCleaner.getDoneMessage()
            expect(doneMessageIds.length).toBe(2);

            
            mock.onPost(producer.api).replyOnce(200,{message: 'success'})
            await producer.actorCleaner.clearRemote(doneMessageIds,[]);//清理远程message
            await producer.actorCleaner.saveSubtaskIdsToConsumer(doneMessageIds);//保存待删除消费方的processor

            await producer.actorCleaner.clearDbMeesage(doneMessageIds);//删除数据库的message
            expect((await producer.actorCleaner.getDoneMessage()).length).toBe(0);

            mock.onPost(contentProducer.api).replyOnce(200,{message: 'success'})
            let watingClearConsumeSubtaskIds = await contentProducer.actorCleaner.getWatingClearConsumeProcessors();
            expect(watingClearConsumeSubtaskIds.length).toBe(2);
            await contentProducer.actorCleaner.clearRemote([],watingClearConsumeSubtaskIds)
            await contentProducer.actorCleaner.clearDbWatingConsumeProcessors(watingClearConsumeSubtaskIds);
    
            expect((await contentProducer.actorCleaner.getWatingClearConsumeProcessors()).length).toBe(0);

        })


        it('.test clear by job',async (done)=>{

            let producer = actorManager.get(producerName); 
            let contentActor = actorManager.get('content'); 
            let clear_interval = 300;
            
            producer.options.clear_interval = clear_interval;
            contentActor.options.clear_interval = clear_interval;

            message = await messageService.create(producerName,messageType,topic,{},{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
        
            
            let prepareResult = {title: 'get new user'};
            mock.onPost(contentActor.api).replyOnce(200,prepareResult)
            mock.onPost(contentActor.api).replyOnce(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })          
            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).replyOnce(200,prepareResult)
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })   


            //把message确认
            await messageService.confirm(producerName,message.id);

            mock.onPost(contentActor.api).replyOnce(200,{message: 'success'})
            mock.onPost(producer.api).replyOnce(200,{message: 'success'})

            // producer.coordinator.getQueue().on('failed',async (job,err)=>{
            //     console.log(job.id,err)
            // })
            //    //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{

                if(job.data.type == JobType.ACTOR_CLEAR){
                    let doneMessage = await producer.actorCleaner.getDoneMessage();
                    expect(doneMessage.length).toBe(0);
                    let watingClearProcessorIds = await producer.actorCleaner.getWatingClearConsumeProcessors();
                    expect(watingClearProcessorIds.length).toBe(1);
                    // await producer.actorCleaner.removeClearJob();
                    await contentActor.actorCleaner.setClearJob();
                    
                }

            })

          
              //任务执行完毕
            contentActor.coordinator.getQueue().on('completed',async (job)=>{
       

                if(job.data.type == JobType.SUBTASK){
                    await producer.actorCleaner.setClearJob();
                }
                
                if(job.data.type == JobType.ACTOR_CLEAR){
                    let watingClearProcessorIds = await contentActor.actorCleaner.getWatingClearConsumeProcessors();
                    expect(watingClearProcessorIds.length).toBe(0);
                    // await contentActor.actorCleaner.removeClearJob();
                    done();
                }

            })

            
            await actorManager.bootstrapActorsCoordinatorprocessor();

           
           
        })

       

    });

    describe('.job:',() => {

        it('.set job after',async ()=>{
            let userProducer = actorManager.get('user');
            await userProducer.actorCleaner.setClearJob();
            let job = await userProducer.coordinator.getJob(await userProducer.actorCleaner.getJobId());
            expect(job).toBeDefined();
    
        })

        it('.clear failed retry',async (done)=>{
            let userProducer = actorManager.get('user');
            userProducer.options.clear_interval = 200;


            let message:TransactionMessage = await userProducer.messageManager.create(MessageType.TRANSACTION,'user.create',{
                delay:200
            })
            await userProducer.messageManager.cancel(message.id);
            mock.onPost(userProducer.api).replyOnce(200,{message: 'success'})
            userProducer.coordinator.getQueue().on('completed',async (job)=>{

                if(message.job_id == job.id){
                    await userProducer.actorCleaner.setClearJob();
                    let job = await userProducer.coordinator.getJob(await userProducer.actorCleaner.getJobId());
                    expect(job).toBeDefined();
                }
                if(await userProducer.actorCleaner.getLastJobId() == job.id){
                    let job = await userProducer.coordinator.getJob(await userProducer.actorCleaner.getJobId());
                    expect(await job.getState()).toBe(JobStatus.DELAYED);
                    done();
                }
            })

            await actorManager.bootstrapActorsCoordinatorprocessor();


        })

    })



});
