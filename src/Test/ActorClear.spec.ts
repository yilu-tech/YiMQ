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
import { MessageStatus, MessageType, MessageClearStatus } from '../Constants/MessageConstants';
import { EcSubtask } from '../Core/Subtask/EcSubtask';
import { SubtaskType, SubtaskStatus } from '../Constants/SubtaskConstants';
import { TccSubtask } from '../Core/Subtask/TccSubtask';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { Message } from '../Core/Messages/Message';
import { JobType, JobStatus } from '../Constants/JobConstants';
import { ActorConfigManager } from '../Core/ActorConfigManager';
import { async } from 'rxjs/internal/scheduler/async';
import { Coordinator } from '../Core/Coordinator/Coordinator';
import { SystemException } from '../Exceptions/SystemException';
import { ActorClearJob } from '../Core/Job/ActorClearJob';
import { Job } from '../Core/Job/Job';
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

        it('get waiting clear message',async()=>{
            let userActor = actorManager.get('user'); 
            let contentActor = actorManager.get('content'); 

            
            for(var i =0;i<10;i++){
                let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.DONE).save();
            }
            //增加一种其他状态的数据
            message = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message.setStatus(MessageStatus.PENDING).save();

            for(var i =0;i<10;i++){
                let message:TransactionMessage = await contentActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.CANCELED).save();
            }


            //验证待删除message数量
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE)
            expect(userDoneMessageIds.length).toBe(10);

            let contentDoneMessageIds = await contentActor.actorCleaner.getMessageIds(MessageStatus.CANCELED)
            expect(contentDoneMessageIds.length).toBe(10);

        })

        it('markFailedMessages',async()=>{
            let userActor = actorManager.get('user'); 
            let contentActor = actorManager.get('content'); 

            
            for(var i =0;i<5;i++){
                let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.DONE).save();
            }

            //验证待删除message数量
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE)
            expect(userDoneMessageIds.length).toBe(5);

            let failedCleardMessageIds = userDoneMessageIds.slice(0,2);
            
            await userActor.actorCleaner.markFailedMessages(failedCleardMessageIds)
            expect((await userActor.actorCleaner.getFailedClearMessageIds())).toEqual(failedCleardMessageIds);
        })

    



        it('clearLocalMessage',async()=>{
            let userActor = actorManager.get('user'); 
            let contentActor = actorManager.get('content'); 
           
            
            for(var i =0;i<5;i++){
                let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.DONE).save();
            }

            //验证待删除message数量
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE)


            let failedCleardMessageIds = userDoneMessageIds.slice(0,2);
            let canCleardMessageIdsForVerify = userDoneMessageIds.slice(2);

            
            let canCleardMessageIds =  await userActor.actorCleaner.clearLocalMessage(userDoneMessageIds,failedCleardMessageIds);
            expect(canCleardMessageIdsForVerify).toEqual(canCleardMessageIdsForVerify);
        })

        it('saveSubtaskIdsToConsumer',async()=>{
            let userActor = actorManager.get('user'); 
            let contentActor = actorManager.get('content'); 

            let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            let userSubtask =  await message.addSubtask(SubtaskType.EC,{
                processor:userActor.name,
                data:{
                    'name':1
                }
            }) 
            let contentSubtask = await message.addSubtask(SubtaskType.EC,{
                processor:contentActor.name,
                data:{
                    'name':1
                }
            })
            await message.setStatus(MessageStatus.DONE).save();

            await userActor.actorCleaner.saveSubtaskIdsToConsumer([message.id]);

            let userWatingClearConsumeProcessorIds = await userActor.actorCleaner.getWatingClearConsumeProcessorIds();
            let contentWatingClearConsumeProcessorIds = await contentActor.actorCleaner.getWatingClearConsumeProcessorIds();
            expect(userWatingClearConsumeProcessorIds).toEqual([userSubtask.id]);
            expect(contentWatingClearConsumeProcessorIds).toEqual([contentSubtask.id])
        })
        it('clearLocalProcessorIds',async()=>{
            let userActor = actorManager.get('user'); 
            let contentActor = actorManager.get('content'); 
           
            
            let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            let userSubtask1 =  await message.addSubtask(SubtaskType.EC,{
                processor:userActor.name,
                data:{
                    'name':1
                }
            }) 
            let userSubtask2 = await message.addSubtask(SubtaskType.EC,{
                processor:userActor.name,
                data:{
                    'name':1
                }
            })
            let userSubtask3 = await message.addSubtask(SubtaskType.EC,{
                processor:userActor.name,
                data:{
                    'name':1
                }
            })
            await message.setStatus(MessageStatus.DONE).save();
            await userActor.actorCleaner.saveSubtaskIdsToConsumer([message.id]);



            let message2:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            let userSubtask4 =  await message2.addSubtask(SubtaskType.EC,{
                processor:userActor.name,
                data:{
                    'name':1
                }
            }) 

            await message2.setStatus(MessageStatus.DONE).save();
            await userActor.actorCleaner.saveSubtaskIdsToConsumer([message2.id]);
            
            let userWatingClearConsumeProcessorIds = await userActor.actorCleaner.getWatingClearConsumeProcessorIds();
            let waittingClearProcessIds = [userSubtask1.id,userSubtask2.id,userSubtask3.id];
            let failedProcessIds = [userSubtask2.id,userSubtask3.id];
            //  1和2,3等待清理，2,3清理错误 ,1被正常清理，4还在等待清理
            await userActor.actorCleaner.clearLocalProcessorIds(waittingClearProcessIds,failedProcessIds)
            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual([userSubtask2.id,userSubtask3.id])
            expect(await userActor.actorCleaner.getWatingClearConsumeProcessorIds()).toEqual([userSubtask4.id])
        })

        it('remoteClearSuccess',async ()=>{
            let userActor = actorManager.get('user'); 
            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[1],
                failed_canceled_message_ids:[],
                failed_process_ids:[20],
                message: 'success'
            });

            let result = await userActor.actorCleaner.remoteClear([1,2],[10,11],[20,30]);
            expect(result).toEqual([
                [1],
                [],
                [20]
            ])
        })

        it('remoteClearMessageFailed',async ()=>{
            let userActor = actorManager.get('user'); 
            mock.onPost(userActor.api).replyOnce(200);
            let err;
            try {
                let result = await userActor.actorCleaner.remoteClear([1,2],[10,11],[20,30]);                
            } catch (error) {
                err = error;
            }

            expect(err).toBeInstanceOf(SystemException);        
        })

        it('run',async()=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 1; //设置清理条数
            //创建两条message开始清理
            let message1:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message1.setStatus(MessageStatus.DONE).save();
            let message2:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message2.setStatus(MessageStatus.DONE).save();
            
            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[message2.id],
                failed_canceled_message_ids:[],
                failed_process_ids:[],
                message: 'success'
            });
            let result = await userActor.actorCleaner.run();
            let updatedMessage2:Message =  await userActor.messageManager.get(message2.id);
            expect(updatedMessage2.clear_status).toBe(MessageClearStatus.FAILED);
        })

        it('runDelayTrue',async()=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 10;
            let message:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10,
            });
            await message.setStatus(MessageStatus.DONE).save();

            let result = await userActor.actorCleaner.run();
            expect(result.delay).toBe(true)
        })

        it('runDelayFalse',async()=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 10;

            for(var i =0;i<10;i++){
                let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.DONE).save();
            }
            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[],
                failed_process_ids:[],
                message: 'success'
            });

            let result = await userActor.actorCleaner.run();
            expect(result.delay).toBe(false)
        })

       


        

       

    });

    describe('.job:',() => {


        it('.setJob',async(done)=>{
            let userActor = actorManager.get('user');

            
            let job1 = await userActor.actorCleaner.setClearJob(false);
            expect(job1).not.toBeNull();
            expect(job1.id).toBe(await userActor.actorCleaner.getActiveJobId())
            let job2 = await userActor.actorCleaner.setClearJob(false);
            expect(job2).toBeNull();//job1还没有完成，所有job设置失败

            userActor.coordinator.getQueue().on('completed',async (job)=>{
                if(job.id == job1.id){
                    let job3 = await userActor.actorCleaner.setClearJob(false);   
                    // //job2已经处理完毕，设置job3成功
                    expect(job3).not.toBeNull(); 
                    expect(job3.id).toBe(await userActor.actorCleaner.getActiveJobId())
                   
                    done();
                }
            })
            userActor.coordinator.getQueue().on('failed',async (job,error)=>{
                done(error);
            })


            userActor.coordinator.getQueue().process('*',async (job)=>{
                return 1;
            })
        })

        it('test clear by real job',async(done)=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 5;

            
            userActor.options.clear_interval = 500;


            let clearJob1 = await userActor.actorCleaner.setClearJob(false)

            userActor.coordinator.getQueue().on('failed',async (error)=>{
                done(error)
        
            })
            let clearJob2:Job;
            let clearJob3:Job
            userActor.coordinator.getQueue().on('completed',async (job,result)=>{
                //clearJob1 完成后创建了，延迟300毫秒的clearJob2
                if(clearJob1.id == job.id){
                    mock.onPost(userActor.api).replyOnce(async ()=>{
                        await timeout(200);
                        return [200,{
                            failed_done_message_ids:[],
                            failed_canceled_message_ids:[],
                            failed_process_ids:[],
                            message: 'success'
                        }]
                    });
                    //模拟5个完成的message给clearJob2，300毫秒后，清理message
                    for(var i =0;i<5;i++){
                        let message:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                            delay:10,
                        });
                        await message.setStatus(MessageStatus.DONE).save();
                    }
                    await timeout(100);//延迟，让ActorClearJob 在onCompleted完成job的创建
                    clearJob2 = await userActor.actorCleaner.getActiveJob();
                    expect(clearJob2.context.opts.delay).toBe(500);
            
                }

                //clearJob2完成后，创建不延迟的clearJob3
                if(clearJob2 && clearJob2.id == job.id){
                    done();
                }

        
            })

            await userActor.coordinator.processBootstrap();
            await userActor.coordinator.onCompletedBootstrap();

        })

        it('.clear failed retry',async (done)=>{

            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 1;

            
            userActor.options.clear_interval = 8000;
 
            let message:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10000,
            });
            await message.setStatus(MessageStatus.DONE).save();

            userActor.options.clear_backoff = 1
            let clearJob1 = await userActor.actorCleaner.setClearJob(false)

            mock.onPost(userActor.api).replyOnce(500);


            let failedTotal = 0;
            userActor.coordinator.getQueue().on('failed',async (job, err)=>{
                failedTotal++;
                mock.onPost(userActor.api).replyOnce(200,{
                    failed_done_message_ids:[],
                    failed_canceled_message_ids:[],
                    failed_process_ids:[],
                    message: 'success'
                });
                expect(clearJob1.id).toBe(job.id)
            })

            userActor.coordinator.getQueue().on('completed',async (job,result)=>{
                await timeout(100);//等到结束，防止redis无法正常关闭
                done()
            })

            await userActor.coordinator.processBootstrap();
            await userActor.coordinator.onCompletedBootstrap();
        })

     

    })



});
