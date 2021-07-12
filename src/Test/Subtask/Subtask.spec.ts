import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { TestApplication } from '../Helpers';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);
describe('subtask', () => {
    

    it('.set subtask status', async () => {
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
        //修改失败
        expect(subtask.setStatusWithTransacation(SubtaskStatus.PREPARING,SubtaskStatus.PREPARED)).rejects.toThrow('SUBTASK_SET_STATUS_ORIGIN_STATUS_MISTAKE');

        //修改成功
        await subtask.setStatusWithTransacation(SubtaskStatus.PREPARED,SubtaskStatus.DOING)
        await subtask.refresh();
        expect(subtask.status).toBe(SubtaskStatus.DOING)

        await testApplication.shutdown()
    });

    it('done subtask and message', async () => {
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

        await message.confirm()//确认message

        await message.refresh();
        await message.toDoing();//执行message(本该job调用)

        //完成subtask，并且一起完成message
        await subtask.completeAndCompleteMessage(SubtaskStatus.DOING,SubtaskStatus.DONE,MessageStatus.DOING,MessageStatus.DONE);

        await subtask.refresh();
        expect(subtask.status).toBe(SubtaskStatus.DONE);


        await message.refresh();
        expect(message.pending_subtask_total).toBe(0);
        expect(message.status).toBe(MessageStatus.DONE);

        await testApplication.shutdown()
    });
});
