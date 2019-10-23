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
const mock = new MockAdapter(axios);

describe('MessageService', () => {
    let actorService:ActorService;
    let config:Config;
    let redisManager:RedisManager;
    let messageService:MessageService;
    let actorManager:ActorManager;


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
        (await redisManager.client()).flushdb();
        actorService = app.get<ActorService>(ActorService);
        await actorService.loadConfigFileToMasterRedis();

        config = app.get<Config>(Config);
        messageService = app.get<MessageService>(MessageService);
        actorManager = app.get<ActorManager>(ActorManager);
        
        await actorManager.initActors();  
    });

    describe('create transaction message', async () => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'goods_create';
        let message:Message;

        
        it('create message', async () => {
           
            message = await messageService.create(producerName,messageType,topic,{
                delay:1000,
                attempts:5,
                backoff:{
                    type:'exponential',
                    delay: 1000  
                }
            });
            expect(message.topic).toBe(topic);
        });

        it('timeout check', async (done) => {
            let producer = actorManager.get(producerName); 
            mock.onPost(producer.api).reply(500,{

            })

            producer.coordinator.getQueue().on('failed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(1)
                    mock.onPost(producer.api).reply(200,{
                        status: MessageStatus.DONE
                    })
                }
            })
            producer.coordinator.getQueue().on('completed',async (job)=>{
                if(message.job.id == job.id){
                    expect(job.data.action).toBe(JobAction.CHECK)
                    expect(job.attemptsMade).toBe(1);
                    done()
                }
            })
            await actorManager.bootstrapActorsCoordinatorProcesser();
        });
    });
});
