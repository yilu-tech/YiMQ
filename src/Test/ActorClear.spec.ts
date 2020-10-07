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
import { SubtaskType } from '../Constants/SubtaskConstants';
import { TccSubtask } from '../Core/Subtask/TccSubtask';
import { TransactionMessage } from '../Core/Messages/TransactionMessage';
import { Message } from '../Core/Messages/Message';
import { JobType } from '../Constants/JobConstants';
import { ActorConfigManager } from '../Core/ActorConfigManager';
import { SystemException } from '../Exceptions/SystemException';
import { ActorClearJob } from '../Core/Job/ActorClearJob';
import { Job } from '../Core/Job/Job';
import { BusinessException } from '../Exceptions/BusinessException';
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
        await actorManager.closeCoordinators();
        await redisManager.quitAllDb();
    })
    

  


    describe('.success:',() => {
        let producerName = 'user';
        let messageType = MessageType.TRANSACTION;
        let topic = 'subtask_test';
        let message:TransactionMessage;

        it('get waiting clear message',async()=>{
            let userActor = actorManager.get('user'); 
            let memberActor = actorManager.get('member');
            let contentActor = actorManager.get('content'); 

            
            for(var i =0;i<2;i++){
                let message:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.DONE).save();
            }
            //user增加一个pending状态
            message = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message.setStatus(MessageStatus.PENDING).save();

            //user增加一个MessageClearStatus.FAILED
            message = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message.setStatus(MessageStatus.DONE).setProperty('clear_status',MessageClearStatus.FAILED).save();

            //同数据库下增加一个member的done message
            message = await memberActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message.setStatus(MessageStatus.DONE).save();

            for(var i =0;i<10;i++){
                let message:TransactionMessage = await contentActor.messageManager.create(messageType,topic,{},{
                    delay:10,
                });
                await message.setStatus(MessageStatus.CANCELED).save();
            }


            //验证待删除message数量
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE,MessageClearStatus.WAITING)
            expect(userDoneMessageIds.length).toBe(2);

            let userFailedMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE,MessageClearStatus.FAILED)
            expect(userFailedMessageIds.length).toBe(1);

            let contentDoneMessageIds = await contentActor.actorCleaner.getMessageIds(MessageStatus.CANCELED,MessageClearStatus.WAITING)
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
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE,MessageClearStatus.WAITING)
            expect(userDoneMessageIds.length).toBe(5);

            let failedCleardMessageIds = userDoneMessageIds.slice(0,2);
            
            await userActor.actorCleaner.markFailedMessages(failedCleardMessageIds)
            expect(((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryDoneMessageIds)).toEqual(failedCleardMessageIds);
        })

        it('getCanCleardIds',()=>{
            //数字和字符串对比
            let userActor = actorManager.get('user'); 
            let originIds = ['1','2'];
            let failedIds = [1];
            let result = userActor.actorCleaner.getCanCleardIds(originIds,failedIds);
            expect(result).toEqual(['2']);
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
            let userDoneMessageIds = await userActor.actorCleaner.getMessageIds(MessageStatus.DONE,MessageClearStatus.WAITING)


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

        it('run doneMessage more than limit',async()=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 2; //设置清理条数
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
            expect(result.cleardDoneMessageIds).toEqual([message1.id])
            
            let updatedMessage2:Message =  await userActor.messageManager.get(message2.id);
            expect(updatedMessage2.clear_status).toBe(MessageClearStatus.FAILED);
        })

        it('run canceledMessage more than limit',async()=>{
            let userActor = actorManager.get('user'); 
            userActor.options.clear_limit = 2; //设置清理条数
            //创建两条message开始清理
            let message1:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message1.setStatus(MessageStatus.CANCELED).save();
            let message2:TransactionMessage = await userActor.messageManager.create(messageType,topic,{},{
                delay:10,
            });
            await message2.setStatus(MessageStatus.CANCELED).save();
            
            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[message2.id],
                failed_process_ids:[],
                message: 'success'
            });
            let result = await userActor.actorCleaner.run();
            expect(result.cleardCanceldMessageIds).toEqual([message1.id])

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

            let clearJobIds = [];
            userActor.coordinator.getQueue().on('completed',async (job,result)=>{
                if(job.data['type'] == JobType.ACTOR_CLEAR){
                    clearJobIds.push(job.id);
                }
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
                    clearJob2 = await userActor.actorCleaner.getActiveClearJob();
                    expect(clearJob2.context.opts.delay).toBe(500);
            
                }
                let doneClearJobIds = await userActor.actorCleaner.getDoneClearJobIds();
                //启动后，没完成一个clear就会清理一个
                if(clearJobIds.length > 1 ){
                    expect(doneClearJobIds.length).toBe(0);
                }

                // clearJob2完成后，创建不延迟的clearJob3
                if(clearJob2 && clearJob2.id == job.id){
                    done();
                }

        
            })

            await userActor.coordinator.processBootstrap();
            await userActor.coordinator.onCompletedBootstrap();

        })

        /**
         * clear 失败后，job 进行自动重试
         */
        it('.clear failed job attempt',async (done)=>{

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



            userActor.coordinator.getQueue().on('failed',async (job, err)=>{
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

    describe('.failed clear retry:',() => {
        it('failedClearMessageRetrySome',async()=>{
            let userActor = actorManager.get('user');

            //done message
            let doneMessage:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10,
            });
            await doneMessage.setStatus(MessageStatus.DONE).save();
            let doneMessageIds = [doneMessage.id];

            await userActor.actorCleaner.markFailedMessages(doneMessageIds);//标记doneMessageIds为清理失败的message
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryDoneMessageIds).toEqual(doneMessageIds)

            //cancled message
            let canceldMessage:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10,
            });
            await canceldMessage.setStatus(MessageStatus.CANCELED).save();
            let canceldMessageIds = [canceldMessage.id];
            await userActor.actorCleaner.markFailedMessages(canceldMessageIds);//标记canceldMessage为清理失败的message
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryCanceldMessageIds).toEqual(canceldMessageIds)


            //done message清理重试成功  canceld message清理重试失败
            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids: canceldMessageIds,
                failed_process_ids:[],
                message: 'success'
            });
            //清理doneMessageIds和canceldMessageIds ，但canceldMessageIds重新清理失败
            await userActor.actorCleaner.clearFailedReTry([...doneMessageIds,...canceldMessageIds],null);
            
            //确认failedRetryDoneMessageIds被清理
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryDoneMessageIds).toEqual([])
            //确认failedRetryCanceldMessageIds还存在
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryCanceldMessageIds).toEqual(canceldMessageIds)
        })

        it('failedClearMessageRetryAll',async()=>{
            let userActor = actorManager.get('user');
            let message1:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10,
            });
            await message1.setStatus(MessageStatus.CANCELED).save();
            let message2:TransactionMessage = await userActor.messageManager.create(MessageType.TRANSACTION,'topic',{},{
                delay:10,
            });
            await message2.setStatus(MessageStatus.CANCELED).save();

            let messageIds = [message1.id,message2.id];

            await userActor.actorCleaner.markFailedMessages(messageIds);
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryCanceldMessageIds).toEqual(messageIds)

            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[],
                failed_process_ids:[],
                message: 'success'
            });
            await userActor.actorCleaner.clearFailedReTry('*',null);
            //确认没有成功清理的canceld message 是否重试清理成功，数量为0
            expect((await userActor.actorCleaner.getFailedClearMessageIds()).failedRetryCanceldMessageIds.length).toEqual(0)
        })

        it('failedClearProcessRetrySuccess',async()=>{
            let userActor = actorManager.get('user');
            let failedProcessorIds = ['3','5'];
            await userActor.actorCleaner.clearLocalProcessorIds([failedProcessorIds],failedProcessorIds);

            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual(failedProcessorIds);

            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[],
                failed_process_ids:[],//3处理失败
                message: 'success'
            });
            await userActor.actorCleaner.clearFailedReTry(null,failedProcessorIds)

            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual([]);
        })
        it('failedClearProcessRetryFailed',async()=>{
            let userActor = actorManager.get('user');
            let failedProcessorIds = ['3','5'];
            await userActor.actorCleaner.clearLocalProcessorIds([failedProcessorIds],failedProcessorIds);

            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual(failedProcessorIds);

            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[],
                failed_process_ids:['3'],//3处理失败
                message: 'success'
            });
            await userActor.actorCleaner.clearFailedReTry(null,failedProcessorIds)

            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual(['3']);
        })
        it('failedClearProcessRetryAll',async()=>{
            let userActor = actorManager.get('user');
            let failedProcessorIds = ["3","5"];
            await userActor.actorCleaner.clearLocalProcessorIds(failedProcessorIds,failedProcessorIds);
            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual(failedProcessorIds);

            mock.onPost(userActor.api).replyOnce(200,{
                failed_done_message_ids:[],
                failed_canceled_message_ids:[],
                failed_process_ids:[],
                message: 'success'
            });
            await userActor.actorCleaner.clearFailedReTry(null,'*')
            expect(await userActor.actorCleaner.getFailedClearProcessIds()).toEqual([]);
        })
    })


});
