
import { JobStatus } from '../../Constants/JobConstants';
import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { EcSubtask } from '../../Core/Subtask/EcSubtask';
import { TestApplication } from '../Helpers';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
describe('ec_subtask', () => {
    

    it('.prepare confirm confirm', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});

  
        let subtask =  <EcSubtask>await message.addSubtask(SubtaskType.EC,{
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        })
        expect(await subtask.getStatus()).toBe(SubtaskStatus.PREPARED);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.PENDING)

        await subtask.refresh();
        await subtask.confirm();
        expect(await subtask.getStatus()).toBe(SubtaskStatus.DOING);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.WAITING)
        
        await subtask.refresh();
        //再次confirm
        expect(subtask.confirm()).rejects.toThrow('SUBTASK_CONFIRM_CURRENT_STATUS_MISTAKE')
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.WAITING)


        await testApplication.shutdown()
    });


       
    it('.prepare cancel cancel', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});

        let subtask = <EcSubtask>await message.addSubtask(SubtaskType.EC,{
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        });
        expect(await subtask.getStatus()).toBe(SubtaskStatus.PREPARED);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.PENDING)

        await subtask.refresh();
        await subtask.cancel();
        expect(await subtask.getStatus()).toBe(SubtaskStatus.CANCELLING);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.WAITING)

        //再次cancel
        expect(subtask.cancel()).rejects.toThrow('SUBTASK_CANCEL_CURRENT_STATUS_MISTAKE')
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.WAITING)

        expect(subtask.confirm()).rejects.toThrow('SUBTASK_CONFIRM_CURRENT_STATUS_MISTAKE')

        await testApplication.shutdown()
    });

    it('.to do remote', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let contentActor = testApplication.actorManager.get('content');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});

        let prepareData = {
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        };

        let subtask = <EcSubtask>await message.addSubtask(SubtaskType.EC,prepareData);
  

        //to do remote success
        mock.onPost(contentActor.api).reply(200,{updatedTitle: 'new title'})
        let result = await subtask.toDoRemote();
        expect(result['updatedTitle']).toBe('new title')

        //to do remote 400 error
        mock.onPost(contentActor.api).reply(400,{message: 'title exists'})
        try {
            await subtask.toDoRemote()
        } catch (error) {
            expect(error.response.message).toBe('title exists')
        }

        await testApplication.shutdown()
    });


    it('to do subtask and message', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let contentActor = testApplication.actorManager.get('content');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
        

        let prepareData = {
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        };
        let subtask = await message.addSubtask(SubtaskType.EC,prepareData)//添加subtask

        await message.confirm()//确认message

        await message.refresh();
        await message.toDoing();//执行message(本该job调用)

        mock.onPost(contentActor.api).reply(200,{updatedTitle: 'new title'})
        await subtask.toDo()

        await subtask.refresh();
        expect(subtask.status).toBe(SubtaskStatus.DONE);


        await message.refresh();
        expect(message.pending_subtask_total).toBe(0);
        expect(message.status).toBe(MessageStatus.DONE);

        await testApplication.shutdown()
    });

    it('to cancel subtask and message', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
        

        let prepareData = {
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        };
        let subtask = await message.addSubtask(SubtaskType.EC,prepareData)//添加subtask

        await message.cancel()//确认message

        await message.refresh();
        await message.toCancelling();//执行message(本该job调用)

        await subtask.toCancel()

        await subtask.refresh();
        expect(subtask.status).toBe(SubtaskStatus.CANCELED);


        await message.refresh();
        expect(message.pending_subtask_total).toBe(0);
        expect(message.status).toBe(MessageStatus.CANCELED);

        await testApplication.shutdown()
    });

  
});
