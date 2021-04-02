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
import { SubtaskType } from '../Constants/SubtaskConstants';
import { MasterModels } from '../Models/MasterModels';
import { services } from '../app.module';
import { Application } from '../Application';
import { ActorConfigManager } from '../Core/ActorConfigManager';
import { ContextLogger } from '../Handlers/ContextLogger';
import { Actor } from '../Core/Actor';
import { EcSubtask } from '../Core/Subtask/EcSubtask';
const mock = new MockAdapter(axios);
describe('message is failed', () => {
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

        it('.add by message listener total 0',async (done)=>{
            let message = await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{
                delay:500,
                backoff:{
                    type:'fixed',
                    delay: 100  // delay*1  delay
                }
            });
            await message.refresh();
            expect(message.is_health).toBe(true);
            // let result = await userActor.redisClient.messageIsFailedCheck('test');
            // expect(message.is_failed).toBe(true);
           
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,['server error.']]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,['server error.']]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,{status: MessageStatus.CANCELED}]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [200,{status: MessageStatus.CANCELED}]
            })
            
            
            userActor.coordinator.getQueue().on('failed',async (job,error)=>{
                await message.refresh()
                let jobLastAttemptsMade = job.attemptsMade - 1;
                if(jobLastAttemptsMade >= 2){
                    expect(message.is_health).toBe(false);
                }else{
                    expect(message.is_health).toBe(true);
                }
            })
            userActor.coordinator.getQueue().on('completed',async (job)=>{
                await message.refresh();
                expect(message.is_health).toBe(true);
                done()
            })
            await userActor.process();  



        })
        

        it('.subtask health',async (done)=>{
            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'test',{},{
                delay:500,
                backoff:{
                    type:'exponential',
                    delay: 100  // delay*1  delay
                }
            });
            await message.refresh();
            expect(message.is_health).toBe(true);
            
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,{'username':'test'}]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,{'username':'test'}]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,{'username':'test'}]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [500,{'username':'test'}]
            })
            mock.onPost(userActor.api).replyOnce(async()=>{
                return [200,{'username':'test'}]
            })
            let ecSubtask = <EcSubtask>await message.addSubtask(SubtaskType.EC,{
                processor:'user@user.update',
                data:{
                    'name':1
                },
                options:{
                    attempts: 5,
                    backoff:{
                        type:'fixed',
                        delay: 100
                    }
                }
            });

            expect(ecSubtask.is_health).toBe(true);
            expect(message.is_health).toBe(true);

            
            userActor.coordinator.getQueue().on('failed',async (job,error)=>{
                await ecSubtask.refresh();
                await message.refresh();
                if(job.id == ecSubtask.job_id && (job.attemptsMade-1) >= 2  ){
                    expect(ecSubtask.is_health).toBe(false);
                    expect(message.is_health).toBe(false);
                }
               
                
            })
            userActor.coordinator.getQueue().on('completed',async (job)=>{
                await ecSubtask.refresh();
                await message.refresh();
                if(job.id == ecSubtask.job_id){
                    expect(ecSubtask.is_health).toBe(true);
                    expect(message.is_health).toBe(true);
                    done();
                }
            })
            await userActor.process();  
            await message.confirm()

        })

      
       

    });

});
