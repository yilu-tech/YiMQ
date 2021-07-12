
import { JobStatus } from '../../Constants/JobConstants';
import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { TestApplication } from '../Helpers';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TccSubtask } from '../../Core/Subtask/TccSubtask';

const mock = new MockAdapter(axios);
describe('tcc_subtask', () => {
    

    it('.create failed after cancel and complete message', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let contentActor = testApplication.actorManager.get('content');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
 
        //创建tccSubtak
        mock.onPost(contentActor.api).replyOnce(400,{title: 'title exists'})
        let subtask = <TccSubtask>await message.addSubtask(SubtaskType.TCC,{
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        })
        expect(subtask.prepareResult.status).toBe(400);
        expect(await subtask.getStatus()).toBe(SubtaskStatus.PREPARING);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.PENDING)

        await message.cancel();//取消message


        await message.toCancelling()//手动执行message取消job执行的内容
        expect(await message.getStatus()).toBe(MessageStatus.CANCELLING)
        expect(await subtask.getStatus()).toBe(SubtaskStatus.CANCELLING)


        mock.onPost(contentActor.api).replyOnce(200,{message: 'success'})
        await subtask.toCancel();//手动执行subtask取消

        expect(await subtask.getStatus()).toBe(SubtaskStatus.CANCELED);
        expect(await message.getStatus()).toBe(SubtaskStatus.CANCELED);


        await testApplication.shutdown()
    });


    it('.create success after done and complete message', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let contentActor = testApplication.actorManager.get('content');

        //创建message
        let message = <TransactionMessage>await userActor.messageManager.create(MessageType.TRANSACTION,'user.create',{},{});
 
        //创建tccSubtak
        mock.onPost(contentActor.api).replyOnce(200,{title: 'new title'})
        let subtask = <TccSubtask>await message.addSubtask(SubtaskType.TCC,{
            processor:'content@title.update',
            data:{
                'title':'new title'
            }
        })


        expect(subtask.prepareResult.status).toBe(200);
        expect(await subtask.getStatus()).toBe(SubtaskStatus.PREPARED);
        expect(subtask.job.getStatus()).resolves.toBe(JobStatus.PENDING)

        await message.confirm();


        await message.toDoing()//手动执行message job执行的内容
        expect(await message.getStatus()).toBe(MessageStatus.DOING)
        expect(await subtask.getStatus()).toBe(SubtaskStatus.DOING)


        mock.onPost(contentActor.api).replyOnce(200,{message: 'success'})
        await subtask.toDo();//手动执行subtask取消

        expect(await subtask.getStatus()).toBe(SubtaskStatus.DONE);
        expect(await message.getStatus()).toBe(SubtaskStatus.DONE);


        await testApplication.shutdown()
    });
  
});
