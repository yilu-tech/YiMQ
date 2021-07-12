import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { TestApplication } from '../Helpers';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Job } from '../../Core/Job/Job';
import { TestJob } from '../../Core/Job/TestJob';
import { JobOptions } from '../../Interfaces/JobOptions';
import { JobStatus } from '../../Constants/JobConstants';

const mock = new MockAdapter(axios);
describe('subtask', () => {
    

    it('.create after complete ', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        let job = new TestJob(userActor);

        let jobOptions:JobOptions = {
            delay: 1000
        }
        await job.create(jobOptions);
        expect(job.getStatus()).resolves.toBe(JobStatus.PENDING);
        expect(job.delay).toBe(1000);
        await job.prepareWithTransaction();
        expect(job.getStatus()).resolves.toBe(JobStatus.DELAYED);
        await job.promoteWithTransaction();
        expect(job.status).toBe(JobStatus.WAITING);
        expect(job.delay).toBe(0);

        await job.setStatusWithTransacation(JobStatus.WAITING,JobStatus.ACTIVE);

        await job.moveToCompleted()
        expect(job.status).toBe(JobStatus.COMPLETED);


        await testApplication.shutdown()
    });


    it('.create after failed ', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        let job = new TestJob(userActor);

        let jobOptions:JobOptions = {
            delay: 1000
        }
        await job.create(jobOptions);


        await job.prepareWithTransaction();

        await job.promoteWithTransaction();



        await job.setStatusWithTransacation(JobStatus.WAITING,JobStatus.ACTIVE);

        await job.moveToFailed()
        expect(job.status).toBe(JobStatus.FAILED);


        await testApplication.shutdown()
    });

});
