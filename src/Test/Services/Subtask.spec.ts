import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../Config';

import { ActorService } from '../../Services/ActorService';
import { RedisManager } from '../../Handlers/redis/RedisManager';
import { join } from 'path';

import { ActorManager } from '../../Core/ActorManager';
import { MessageService } from '../../Services/MessageService';
import { MessageType, MessageStatus } from '../../Constants/MessageConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../../Constants/SubtaskConstants';
import { EcSubtask } from '../../Core/Subtask/EcSubtask';
import { TccSubtask } from '../../Core/Subtask/TccSubtask';
import { MasterModels } from '../../Models/MasterModels';
import { services } from '../../app.module';
import { BcstSubtask } from '../../Core/Subtask/BcstSubtask';
import { Application } from '../../Application';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
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
            ActorManager,
            Application,
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
    });

    afterEach(async()=>{
        
        await actorManager.closeActors();
        await redisManager.quitAllDb();
    })
    

  


    describe('.create:', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


        it('.add ec subtask', async () => {

           
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
            let processorName = 'content@post.change';

            let ecSubtask = await message.addSubtask(SubtaskType.EC,{
                processor:processorName,
                data:{
                    'name':1
                }
            });
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
     
            let savedSubtask = updatedMessage.subtasks[0];
            expect(savedSubtask.id).toBe(ecSubtask.id);
            expect(savedSubtask.status).toBe(SubtaskStatus.PREPARED);
        });

        it('.add tcc subtask', async () => {
          
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
            mock.onPost(producer.api).reply(200,{
                title: 'get new post'
            })

            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:'user@user.create',
                data:{
                    title: 'new post'
                }
            }) 

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            let savedTccSubtask = updatedMessage.subtasks[0];
            expect(savedTccSubtask.id).toBe(tccsubtask.id);
            expect(savedTccSubtask.toJson()['data'].title).toBe('new post');
            expect(savedTccSubtask.toJson()['prepareResult'].title).toBe('get new post');
            expect(savedTccSubtask['prepareResult'].title).toBe('get new post');
        });


        it('.add ec tcc subtask', async () => {

           
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })
            let producer = actorManager.get(producerName); 
            let contentActor = actorManager.get('content'); 

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            let savedEcSubtask = updatedMessage.subtasks[0];;
            expect(savedEcSubtask.type).toBe(SubtaskType.EC);
            expect(savedEcSubtask.status).toBe(SubtaskStatus.PREPARED);
            expect(updatedMessage.pending_subtask_total).toBe(1);

            mock.onPost(contentActor.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })

            updatedMessage = await producer.messageManager.get(message.id);
            let savedTccSubtask = updatedMessage.subtasks[1];
            expect(savedTccSubtask.type).toBe(SubtaskType.TCC);
            expect(updatedMessage.pending_subtask_total).toBe(2);
            
        });

        it('.add ec by prepare', async () => {
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            let processorName = 'content@post.create';
            let producer = actorManager.get(producerName); 
            let body = {
                prepare_subtasks:[
                    {
                        type:SubtaskType.EC,
                        processor:'user@update',
                        data:{'title':'test'}
                    },
                    {
                        type:SubtaskType.EC,
                        processor:'user@update1',
                        data:{'title':'test1'}
                    }
                ]
            }
            let prepareResult = await messageService.prepare(producerName,message.id,body);
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.subtasks.length).toBe(2);
            expect(updatedMessage.subtasks['0'].data).toMatchObject(body.prepare_subtasks[0].data);
            expect(updatedMessage.subtasks['1'].data).toMatchObject(body.prepare_subtasks[1].data)
        })

        it('.add tcc failed', async () => {

           
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)



            let processorName = 'content@post.create';
            let producer = actorManager.get(producerName); 
            mock.onPost(producer.api).reply(400,{
                title: 'exists'
            })
            try {
                let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                    processor:'content@post.create',
                    data: 'new post'
                })                
        } catch (error) {
                let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                let savedTccSubtask = updatedMessage.subtasks[0];
                expect(savedTccSubtask.type).toBe(SubtaskType.TCC);
                expect(savedTccSubtask['prepareResult']).toBeDefined()
            }
        });

        it('.add bcst by prepare', async (done) => {
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
            let body = {
                prepare_subtasks:[
                    {
                        type:'BCST',
                        topic:'user.update',
                        data:{'title':'test'}
                    }
                ]
            }
            let prepareResult = await messageService.prepare(producerName,message.id,body);
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.subtasks['0'].data).toMatchObject(body.prepare_subtasks[0].data);
            
              //任务执行完毕
              producer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await producer.messageManager.get(message.id);

                let bcstSubtask:BcstSubtask = <BcstSubtask>updatedMessage.subtasks[0];
                await bcstSubtask.loadBroadcastMessage();


                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING);
                    
                }

                if(bcstSubtask.broadcastMessage.job_id == job.id){
                    expect(bcstSubtask.broadcastMessage.status).toBe(MessageStatus.DOING)
                    done()   
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
             //把message确认
            await messageService.confirm(producerName,message.id);
        })

    });

    describe('.doning:', async () => {

        //TODO 建立不同的配置文件隔离producer否则并行测试可能会发生冲突
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


        it('.message confirm ec doning', async (done) => {

           
            message = await messageService.create(producerName,messageType,topic,{
                delay:300,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.status).toBe(MessageStatus.PENDING)
            expect(message.job_id).toBe(1)

            
            let producer = actorManager.get(producerName); 

            let prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            process.env.SUBTASK_JOB_DELAY = '2000';//延迟subtask的job执行，便于只测试message job
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })   

            //把message确认
            await messageService.confirm(producerName,message.id);
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);

            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    //检查EcSubtask
                    expect(updatedMessage.subtasks[0].type).toBe(SubtaskType.EC)
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING)
                    expect(updatedMessage.subtasks[0].job_id).toBe(2)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });


       

        it('.message confirm ec and tcc doning', async (done) => {

            let contentActor = actorManager.get('content'); 
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
            process.env.SUBTASK_JOB_DELAY = '2000';//延迟subtask的job执行，便于只测试message job
            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(contentActor.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })   

            //把message确认
            await messageService.confirm(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);

            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message

                    //检查TccsSubtask
                    expect(updatedMessage.subtasks[0].type).toBe(SubtaskType.TCC)
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING)

                    //检查EcSubtask
                    expect(updatedMessage.subtasks[1].type).toBe(SubtaskType.EC)
                    expect(updatedMessage.subtasks[1].status).toBe(SubtaskStatus.DOING)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });


        it('.message confirm after add  ec and tcc', async () => {

           
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
            //把message确认
            await messageService.confirm(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);

            let prepareResult = {title: 'get new user'};


            let tccErrorMessage;
            try {
                let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                    processor:"content@content.create",
                    data:{
                        title: 'new post'
                    }
                })  
            } catch (error) {
                tccErrorMessage = error.message;
            }        
            expect(tccErrorMessage).toBe('The status of this message is DOING instead of PENDING');

            let ECErrorMessage;
            try {
                let ecSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                    processor:"content@content.create",
                    data:{
                        title: 'new post'
                    }
                })   
            } catch (error) {
                ECErrorMessage = error.message;
            }        
            expect(ECErrorMessage).toBe('The status of this message is DOING instead of PENDING');

        });

    });


    describe('.done:', async () => {

        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


       

        it('.message confirm ec tcc to done', async (done) => {

            let contentActor = actorManager.get('content'); 
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
            process.env.SUBTASK_JOB_DELAY = '500';//加快二次尝试，防止测试超时
            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(contentActor.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"content@post.create",
                data:{
                    title: 'new post'
                }
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);
            

            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })   


            //把message确认
            await messageService.confirm(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);
            expect(updatedMessage.pending_subtask_total).toBe(2);
            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                // console.log(job.toJSON(),err)
            })
            
            mock.onPost(producer.api).reply(200,{message:'subtask process succeed'})
            //任务开始执行
            producer.coordinator.getQueue().on('active',async (job)=>{
                console.debug('Job active',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){
                    expect(job.data.message_id).toBe(updatedMessage.id);
                }
                else if(updatedMessage.subtasks[1].job_id == job.id){
                    expect(job.data.producer_id).toBe(updatedMessage.producer.id);

                }
            })
            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await producer.messageManager.get(message.id);
                if(message.job.id == job.id){
                    
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DONE);
                }
                else if(updatedMessage.subtasks[1].job_id == job.id){
                    expect(updatedMessage.subtasks[1].status).toBe(SubtaskStatus.DONE);
                }

                if(updatedMessage.pending_subtask_total == 0){
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                    let messageIds = await producer.messageModel.find({
                        status: MessageStatus.DONE
                    })
                    expect(messageIds.length).toBe(1);
                    let subtaskIds = await producer.subtaskModel.find({
                        status: SubtaskStatus.DONE
                    })
                    expect(subtaskIds.length).toBe(2);
                    console.log('--->',messageIds,subtaskIds)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });



        it('.message confirm tcc remote call failed to done', async (done) => {

           
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

            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //把message确认
            await messageService.confirm(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);

        
            process.env.SUBTASK_JOB_BACKOFF_DELAY = '100';//加快二次尝试，防止测试超时
            mock.onPost(producer.api).timeout()//模拟超时
            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                updatedMessage = await producer.messageManager.get(message.id);
                if(updatedMessage.subtasks[0].job_id != job.id){
                   return;
                }
                if(job.attemptsMade == 1){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING);
                    mock.onPost(producer.api).reply(400,{message:'server error'})//模拟400错误
                }else if(job.attemptsMade == 2){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DOING);
                    mock.onPost(producer.api).reply(200,{message:'success'})
                }
            })
            
            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                console.debug('Job completed',job.id)


                if(message.job.id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DONE);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
        });

    });


    describe('.canceled:', async () => {

        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


       

        it('.message cancel ec tcc to canceled', async (done) => {

           
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

            process.env.SUBTASK_JOB_DELAY = '200';//子任务延迟，否则会有一定几率比message的job先执行完毕

            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })   

            //把message确认
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);

            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                console.log(err)
            })
            
            let doneCont = 0;
            mock.onPost(producer.api).reply(async()=>{
                await timeout(10);//延迟tcc事务的cancel,否则由于处理太快单元测试会done两次
                return [200,{message:'subtask process succeed'}];
            })
            //任务开始执行
            producer.coordinator.getQueue().on('active',async (job)=>{
                // console.debug('Job active',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(job.data.message_id).toBe(updatedMessage.id);
                }
                else if(updatedMessage.subtasks[1].job_id == job.id){
                    expect(job.data.producer_id).toBe(updatedMessage.producer.id);

                }
            })
            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id); 
                //tips:: 不能在if外查询，有可能已经done了，还有任务完成，但是redis已经被关闭 TODO::如果还有问题，实现一个bull.process强制暂停，done后直接暂停

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                }

                if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELED);
                }

                if(updatedMessage.subtasks[1].job_id == job.id){

                    expect(updatedMessage.subtasks[1].status).toBe(SubtaskStatus.CANCELED);
                   
                }
                // console.log(job.id,updatedMessage.toJson())
                if(updatedMessage.pending_subtask_total == 0){

                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)

                    let messageIds = await producer.messageModel.find({
                        status: MessageStatus.CANCELED
                    })
                    expect(messageIds.length).toBe(1);
                    let subtaskIds = await producer.subtaskModel.find({
                        status: SubtaskStatus.CANCELED
                    })
                    expect(subtaskIds.length).toBe(2);
                    expect(++doneCont).toBe(1);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });


        it('.message cancel ec to canceled', async (done) => {

           
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

            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
    


            prepareResult = {title: 'get update user'};
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.EC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })   

            //把message取消
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);

            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                console.log(err)
            })
            


            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                // console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELED);
                    expect(updatedMessage.pending_subtask_total).toBe(0);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();

        });



        it('.message confirm tcc remote call failed to canceled', async (done) => {

           
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

            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,SubtaskType.TCC,{
                processor:"user@user.create",
                data:{
                    username: 'jack'
                }
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //把message确认
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);

        
            process.env.SUBTASK_JOB_BACKOFF_DELAY = '100';//加快二次尝试，防止测试超时
            mock.onPost(producer.api).timeout()//模拟超时
            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                
           
                if(job.attemptsMade == 1){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELLING);
                    mock.onPost(producer.api).reply(400,{message:'server error'})//模拟400错误
                }else if(job.attemptsMade == 2){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELLING);
                    mock.onPost(producer.api).reply(200,{message:'success'})
                }
            })
            
            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                // console.debug('Job completed',job.id)
               

                if(message.job.id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){
                    updatedMessage = await producer.messageManager.get(message.id);
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELED);
                    done()
                }
                //TODO 子任务完成后检查message状态为完成
            })
            await actorManager.bootstrapActorsCoordinatorprocessor();
        });

    });
});
