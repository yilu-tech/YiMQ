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
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../../Constants/SubtaskConstants';
import { EcSubtask } from '../../Core/Subtask/EcSubtask';
import { TccSubtask } from '../../Core/Subtask/TccSubtask';
const mock = new MockAdapter(axios);
describe('Subtask', () => {
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
    

  


    describe('.create:', async () => {
        //TODO 建立不同的配置文件隔离producer否则并行测试可能会发生冲突
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
            let processerName = 'content@post.change';

            let ecSubtask = await message.addSubtask(SubtaskType.EC,processerName,{'name':1});
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
     
            let savedSubtask = updatedMessage.subtasks[0];
            expect(savedSubtask.id).toBe(ecSubtask.id);
            expect(savedSubtask.processer).toBe(processerName);
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

            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'content@post.create',
                data: 'new post'
            }) 

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            let savedTccSubtask = updatedMessage.subtasks[0];
            expect(savedTccSubtask.id).toBe(tccsubtask.id);
            expect(savedTccSubtask.toJson()['data']).toBe('new post');
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

            let ecSubtask:EcSubtask = await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.EC,
                processerName: 'content@post.change',
                data: 'change post content'
            })
            let producer = actorManager.get(producerName); 
            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            let savedEcSubtask = updatedMessage.subtasks[0];;
            expect(savedEcSubtask.type).toBe(SubtaskType.EC);
            expect(savedEcSubtask.status).toBe(SubtaskStatus.PREPARED);
            

            mock.onPost(producer.api).reply(200,{
                title: 'hello world'
            })
            let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'content@post.create',
                data: 'new post'
            })

            updatedMessage = await producer.messageManager.get(message.id);
            let savedTccSubtask = updatedMessage.subtasks[1];
            expect(savedTccSubtask.type).toBe(SubtaskType.TCC);
            
        });

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



            let processerName = 'content@post.create';
            let producer = actorManager.get(producerName); 
            mock.onPost(producer.api).reply(400,{
                title: 'exists'
            })
            try {
                let tccsubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                    type: SubtaskType.TCC,
                    processerName: 'content@post.create',
                    data: 'new post'
                })                
            } catch (error) {
                let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
                let savedTccSubtask = updatedMessage.subtasks[0];
                expect(savedTccSubtask.type).toBe(SubtaskType.TCC);
                expect(savedTccSubtask['prepareResult'].status).toBe(400);
            }
        });

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
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.EC,
                processerName: 'user@user.update',
                data: 'update user'
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
            await actorManager.bootstrapActorsCoordinatorProcesser();

        });


       

        it('.message confirm ec and tcc doning', async (done) => {

           
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
            mock.onPost(producer.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'user@user.create',
                data: 'new user'
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.EC,
                processerName: 'user@user.update',
                data: 'update user'
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
            await actorManager.bootstrapActorsCoordinatorProcesser();

        });

    });


    describe('.done:', async () => {

        //TODO 建立不同的配置文件隔离producer否则并行测试可能会发生冲突
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;


       

        it('.message confirm ec tcc to done', async (done) => {

           
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
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'user@user.create',
                data: 'new user'
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.EC,
                processerName: 'user@user.update',
                data: 'update user'
            })   

            //把message确认
            await messageService.confirm(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING);

            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                console.log(err)
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
                console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DONE);
                }
                else if(updatedMessage.subtasks[1].job_id == job.id){
                    expect(updatedMessage.subtasks[1].status).toBe(SubtaskStatus.DONE);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();

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
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'user@user.create',
                data: 'new user'
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
                // console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.DOING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DONE);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });

    });


    describe('.canceled:', async () => {

        //TODO 建立不同的配置文件隔离producer否则并行测试可能会发生冲突
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

            //mock添加tcc子任务时的远程调用
            let prepareResult = {title: 'get new user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'user@user.create',
                data: 'new user'
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //mock添加ec子任务时的远程调用
            prepareResult = {title: 'get update user'};
            mock.onPost(producer.api).reply(200,prepareResult)
            let ecSubtask:EcSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.EC,
                processerName: 'user@user.update',
                data: 'update user'
            })   

            //把message确认
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);

            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                console.log(err)
            })
            
            mock.onPost(producer.api).reply(200,{message:'subtask process succeed'})
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
                // console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELED);
                }
                else if(updatedMessage.subtasks[1].job_id == job.id){
                    expect(updatedMessage.subtasks[1].status).toBe(SubtaskStatus.CANCELED);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();

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
            let tccSubtask:TccSubtask= await messageService.addSubtask(producerName,message.id,{
                type: SubtaskType.TCC,
                processerName: 'user@user.create',
                data: 'new user'
            })          
            expect(tccSubtask.toJson()['prepareResult'].title).toBe(prepareResult.title);

            //把message确认
            await messageService.cancel(producerName,message.id);

            let updatedMessage:TransactionMessage = await producer.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING);

        
            process.env.SUBTASK_JOB_BACKOFF_DELAY = '100';//加快二次尝试，防止测试超时
            mock.onPost(producer.api).timeout()//模拟超时
            producer.coordinator.getQueue().on('failed',async(job,err)=>{
                updatedMessage = await producer.messageManager.get(message.id);
                if(updatedMessage.subtasks[0].job_id != job.id){
                   return;
                }
                if(job.attemptsMade == 1){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELLING);
                    mock.onPost(producer.api).reply(400,{message:'server error'})//模拟400错误
                }else if(job.attemptsMade == 2){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELLING);
                    mock.onPost(producer.api).reply(200,{message:'success'})
                }
            })
            
            //任务执行完毕
            producer.coordinator.getQueue().on('completed',async (job)=>{
                // console.debug('Job completed',job.id)
                updatedMessage = await producer.messageManager.get(message.id);

                if(message.job.id == job.id){
                    expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)//检查message
                    
                }else if(updatedMessage.subtasks[0].job_id == job.id){

                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.CANCELED);
                    done()
                }
                //TODO 子任务完成后检查message状态为完成
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });

    });
});
