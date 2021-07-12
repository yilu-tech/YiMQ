

import { Types } from 'mongoose';
import { JobStatus, JobType } from '../../Constants/JobConstants';
import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { TestApplication } from '../Helpers';

describe('message', () => {
    

    describe('.create', () => {
  

        it('.success', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            // let messageInit = await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            console.time('message.create.success')
            let message = await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            console.timeEnd('message.create.success')
            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.id).toBe(message.id)
            await updatedMessage.loadJob();
            expect(updatedMessage.job.id).toEqual(updatedMessage.job_id)
            await testApplication.shutdown()
        });
        /**
         * 模拟job提交失败，事务回滚，确认数据库中不存在message
         */
        it('.create_job_failed_transaction_check',async()=>{
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            await expect(userActor.messageManager.create(MessageType.TRANSACTION,'create_job_failed',{},{})).rejects.toThrow('create_job_failed')
            let messageModel = await testApplication.database.MessageModel.where({topic:'create_job_failed'}).findOne();
            expect(messageModel).toBeNull();
            await testApplication.shutdown()
        })

    })


    describe('.subtask', () => {

       
        it('.add success', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let subtask1 = await message.addSubtask(SubtaskType.EC,{
                processor:'content@title.update',
                data:{
                    'title':'new title'
                }
            })
            let subtask2 = await message.addSubtask(SubtaskType.EC,{
                processor:'content@title.update',
                data:{
                    'title':'new title'
                }
            })

            

            // await message.refresh();
            let updateMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            expect(updateMessage.pending_subtask_total).toBe(2);
            expect(updateMessage.subtask_total).toBe(2);

            await updateMessage.loadSubtasks();
            expect(updateMessage.subtasks.length).toBe(2);
            expect(updateMessage.subtasks[0].status).toBe(SubtaskStatus.PREPARED);
            expect(updateMessage.subtasks[1].status).toBe(SubtaskStatus.PREPARED);

            await testApplication.shutdown()
        });

        it('.failed to add subtask because it is not pending', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.confirm()
            let subtaskPromise =  message.addSubtask(SubtaskType.EC,{
                processor:'content@title.update',
                data:{
                    'title':'new title'
                }
            })
            await expect(subtaskPromise).rejects.toThrow('MESSAGE_ADD_SUBTASK_STATUS_MISTAKE');

            await message.refresh();
            expect(message.pending_subtask_total).toBe(0);
            expect(message.subtask_total).toBe(0);

            await testApplication.shutdown()
        });
        

    })


    describe('.prepare', () => {
  
        it('.prepare success', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.prepare({});

            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.PREPARED);

            await testApplication.shutdown()
        });

        it('.prepared after prepare', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.prepare({});

            await expect(message.prepare({})).rejects.toThrow('MESSAGE_PREPARE_STATUS_MISTAKE');

            await testApplication.shutdown()
        });

        it('.prepared after add subtask', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.prepare({});
            let subtask1Promise = message.addSubtask(SubtaskType.EC,{
                processor:'content@title.update',
                data:{
                    'title':'new title'
                }
            })
            await expect(subtask1Promise).rejects.toThrow('MESSAGE_ADD_SUBTASK_STATUS_MISTAKE');

            await testApplication.shutdown()
        });

        it('.prepare add subtasks', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
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
            await message.prepare(body);
            expect(message.pending_subtask_total).toBe(2);
            expect(message.subtask_total).toBe(2);
            expect(message.status).toBe(MessageStatus.PREPARED)

            await testApplication.shutdown()
        });
    })


    describe('.confirm', () => {
  
        it('.confirm success', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.confirm();

            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DOING)
            await updatedMessage.loadJob();
            expect(updatedMessage.job.status).toBe(JobStatus.WAITING);


            await testApplication.shutdown()
        });

        it('.confirmed after comfirm', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.confirm();

            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            let result = await updatedMessage.confirm()
            expect(result.message).toBe('Message already DOING.');

            await testApplication.shutdown()
        });

        it('.prepared after comfirm after prepare', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.prepare({});

            await message.refresh();
            expect(message.status).toBe(MessageStatus.PREPARED);
            await message.confirm();

            await message.refresh();
            expect(message.status).toBe(MessageStatus.DOING);

            await expect(message.prepare({})).rejects.toThrow('MESSAGE_PREPARE_STATUS_MISTAKE');

            await testApplication.shutdown()
        });



        it('.status change when confirm', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await testApplication.database.MessageModel.findOneAndUpdate({_id:message.id},{
                $set:{
                    status:MessageStatus.CANCELED
                }
            })
            await expect(message.confirm()).rejects.toThrow("The message is in the CANCELED state and cannot be changed to DOING");

            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELED)
            await updatedMessage.loadJob();
            expect(updatedMessage.job.status).toBe(JobStatus.DELAYED);


            await testApplication.shutdown()
        });

        it('.confirm after to canceling', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.confirm();
            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await expect(updatedMessage.toCancelling()).rejects.toThrow('The status of this message is DOING.');
            expect(await updatedMessage.getStatus()).toBe(MessageStatus.DOING);
            await testApplication.shutdown()
        });
    })


    describe('.cancel', () => {
  
        it('.cancel success', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.cancel();

            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELLING)
            await updatedMessage.loadJob();
            expect(updatedMessage.job.status).toBe(JobStatus.WAITING);


            await testApplication.shutdown()
        });

        it('.canceled after cancel', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.cancel();

            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            let result = await updatedMessage.cancel()
            expect(result.message).toBe('Message already CANCELLING.');

            await testApplication.shutdown()
        });

        it('.prepared after cancel after prepare', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await message.prepare({});

            await message.refresh();
            expect(message.status).toBe(MessageStatus.PREPARED);
            await message.cancel();

            await message.refresh();
            expect(message.status).toBe(MessageStatus.CANCELLING);

            await expect(message.prepare({})).rejects.toThrow('MESSAGE_PREPARE_STATUS_MISTAKE');

            await testApplication.shutdown()
        });



        it('.status change when cancel', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');



            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            await testApplication.database.MessageModel.findOneAndUpdate({_id:message.id},{
                $set:{
                    status:MessageStatus.DONE
                }
            })
            await expect(message.cancel()).rejects.toThrow('The message is in the DONE state and cannot be changed to CANCELLING');

            let updatedMessage = await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DONE)
            await updatedMessage.loadJob();
            expect(updatedMessage.job.status).toBe(JobStatus.DELAYED);

            await testApplication.shutdown()
        });

        it('.cancel after to doing', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.cancel();
            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await expect(updatedMessage.toDoing()).rejects.toThrow('The status of this message is CANCELLING.');
            expect(await updatedMessage.getStatus()).toBe(MessageStatus.CANCELLING);
            await testApplication.shutdown()
        });
    })


    describe('.doing', () => {
        it('.doing when not have subtask to done', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.confirm();
            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.toDoing()

            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.DONE)

            await testApplication.shutdown()
        });

       
    })

    describe('.canceling', () => {
        it('.doing when not have subtask to done', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.cancel();
            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            await updatedMessage.toCancelling()

            updatedMessage = <TransactionMessage>await userActor.messageManager.get(message.id);
            expect(updatedMessage.status).toBe(MessageStatus.CANCELED)

            await testApplication.shutdown()
        });
       
    })

    describe('other', () => {
        it('.lock status to change', async () => {
            let testApplication = new TestApplication();
            await testApplication.init('message');

            let userActor = testApplication.actorManager.get('user');

            let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
            let originStatus = message.status;

            await testApplication.database.MessageModel.updateOne({_id: message.id},{status:MessageStatus.DONE});

            await expect(message.setStatusWithTransacation(originStatus,MessageStatus.DOING)).rejects.toThrow('The message is in the DONE state and cannot be changed to DOING')
            await testApplication.shutdown();
        });
       
    })
    


  
});
