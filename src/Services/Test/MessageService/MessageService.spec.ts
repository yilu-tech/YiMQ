import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../../../Config';
import { MasterNohm } from '../../../Bootstrap/MasterNohm';
import { ActorService } from '../../ActorService';
import { RedisManager } from '../../../Handlers/redis/RedisManager';
import { MasterModels } from '../../..//Models/MasterModels';
import { join } from 'path';
import { ConfigToMasterRedis } from '../../../Bootstrap/ConfigToMasterRedis';
import { modelsInjects, ActorManagerBootstrap } from '../../../app.module';
import { ActorManager } from '../../../Core/ActorManager';
import { MessageManager } from '../../../Core/MessageManager';
import { services } from '../../../Services';
import { MessageService } from '../../../Services/MessageService';
import { MessageType, MessageStatus } from '../../../Constants/MessageConstants';
import { Message } from '../../../Core/Messages/Message';
import { Logger } from '@nestjs/common';
import { Job } from '../../../Core/Job/Job';
import { JobAction } from '../../../Constants/JobConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { async } from 'rxjs/internal/scheduler/async';
import { RedisClient } from 'src/Handlers/redis/RedisClient';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('MessageService', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;
    let redisClient:RedisClient;

    beforeAll(async () => {
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
        redisClient = await redisManager.client();
        await redisClient.flushdb();
        actorService = app.get<ActorService>(ActorService);
        await actorService.loadConfigFileToMasterRedis();

        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        actorManager = app.get<ActorManager>(ActorManager);
        
        await actorManager.initActors();  
    });

    afterAll(async()=>{
        await actorManager.closeActors();
        await redisClient.quit()
    })
    

    /**
     * 错误后，通过检查状态，校正任务完成
     */
    describe('create transaction message to failed-done', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        
        it('create message', async (done) => {
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:500,
                attempts:5,
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

            producer.coordinator.getQueue().on('failed',async (job)=>{
                
                if(message.job.id == job.id && job.attemptsMade == 1){//模拟pending
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(1)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.PENDING
                    })
                }
                else if(message.job.id == job.id && job.attemptsMade == 2){//模拟done
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(2)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.DONE
                    })
                }
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(2);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });

    });

    describe('create transaction message to cancel', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        
        it('create message', async (done) => {
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:500,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 100  
                }
            });
            expect(message.topic).toBe(topic);
            let producer = actorManager.get(producerName); 

            mock.onPost(producer.api).reply(200,{
                status: MessageStatus.CANCELED
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    done()
                }
            })
        });
    });
});
