import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';

import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';

import { ActorManager } from '../Core/ActorManager';

import { MessageService } from '../Services/MessageService';
import { MessageType, MessageStatus, ActorMessageStatus } from '../Constants/MessageConstants';
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
describe('JobBackOff', () => {
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
        mock.reset()

        userActor = actorManager.get('user');
        
    });

    afterEach(async()=>{
        await actorManager.shutdown();
        await redisManager.closeAll();
    })
    

  


    describe('.message standard backoff', () => {


        it('.standard backoff',async (done) => {

            process.env.STANDARD_BACKOFF_UNIT_TIME = '1';
            await actorManager.bootstrap(false); //这行必须beforeEach启动
            let userActor = actorManager.get('user');
            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'test.topic',{},{
                delay:10
            });

            mock.onPost(userActor.api,{asymmetricMatch:(body)=>{
                if(body.context.attemptsMade < 5){
                    return true;
                }else{
                    return false;
                }
                
            }}).reply(()=>{
                return [500,{message:'database error'}]
            })

            mock.onPost(userActor.api,{asymmetricMatch:(body)=>{
                if(body.context.attemptsMade == 5){
                    return true;
                }else{
                    return false;
                }
            }}).reply(()=>{
                return [200,{status: ActorMessageStatus.DONE}]
            })
        
            userActor.coordinator.getQueue().on('failed',async (job,err)=>{
                
            })
            userActor.coordinator.getQueue().on('completed',async (job)=>{
                await message.refresh();
                expect(job.attemptsMade).toBe(5);
                expect(message.status).toBe(MessageStatus.DONE);
                expect(message.is_health).toBe(true);
                done();
            })
            await userActor.process();

            
           

            
        })

    })

});
