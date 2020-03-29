import { Test, TestingModule } from '@nestjs/testing';
import { Config } from '../Config';
import { MasterNohm } from '../Bootstrap/MasterNohm';
import { ActorService } from '../Services/ActorService';
import { RedisManager } from '../Handlers/redis/RedisManager';
import { join } from 'path';
import { modelsInjects} from '../app.module';
import { ActorManager } from '../Core/ActorManager';
import { services } from '../Services';
import { MessageService } from '../Services/MessageService';
import { MessageType, MessageStatus } from '../Constants/MessageConstants';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { SubtaskType, SubtaskStatus } from '../Constants/SubtaskConstants';
import { EcSubtask } from '../Core/Subtask/EcSubtask';
import { TccSubtask } from '../Core/Subtask/TccSubtask';
import { BcstSubtask } from '../Core/Subtask/BcstSubtask';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('Subtask', () => {
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
        await actorManager.closeActors();
        await redisManager.quitAllDb();
    })
    

  


    describe('.create:', async () => {


        it('.add ec subtask', async (done) => {
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
                delay:300,
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

            let bcstSubtask:BcstSubtask;
            let listenerDoneCount = 0;
            userProducer.coordinator.getQueue().on('completed',async (job)=>{
                updatedMessage = await userProducer.messageManager.get(message.id);
                bcstSubtask = await userProducer.subtaskManager.get(prepareResult['prepare_subtasks'][0].id);

                if(updatedMessage.subtasks[0].job_id == job.id){
                    expect(updatedMessage.subtasks[0].status).toBe(SubtaskStatus.DONE);
                }

                if(bcstSubtask.listenerSubtasks.length > 0 && bcstSubtask.listenerSubtasks[0].job_id == job.id){
                    console.log('userProducer',job.id)
                    listenerDoneCount++
                    if(listenerDoneCount == 2)done();
                }



                if(updatedMessage.pending_subtask_total == 0){
                    expect(updatedMessage.status).toBe(MessageStatus.DONE)
                }
            })

            contentProducer.coordinator.getQueue().on('completed',async (job)=>{
                bcstSubtask = await userProducer.subtaskManager.get(prepareResult['prepare_subtasks'][0].id);

                if(bcstSubtask.listenerSubtasks.length > 0 && bcstSubtask.listenerSubtasks[1].job_id == job.id){
                    console.log('contentProducer',job.id)
                    listenerDoneCount++
                    if(listenerDoneCount == 2)done();
                }

            })
            await actorManager.bootstrapActorsCoordinatorprocessor();


            await message.confirm();

        });

       

    });



});
