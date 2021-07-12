import { MessageStatus, MessageType } from '../../Constants/MessageConstants';
import { SubtaskStatus, SubtaskType } from '../../Constants/SubtaskConstants';
import { TransactionMessage } from '../../Core/Messages/TransactionMessage';
import { TestApplication } from '../Helpers';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Job } from '../../Core/Job/Job';
import { TestJob } from '../../Core/Job/TestJob';
import { JobOptions } from '../../Interfaces/JobOptions';
import {  JobEventType, JobStatus } from '../../Constants/JobConstants';
import { timeout } from '../../Handlers';
const CancelToken = axios.CancelToken;

const mock = new MockAdapter(axios);
describe('subtask', () => {
    

    it('.create ', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');

        let job = new TestJob(userActor);

        let jobOptions:JobOptions = {
            delay: 5000
        }
        await job.create(jobOptions);
        await job.prepareWithTransaction();
        console.log(job.id)

        expect(await userActor.coordinator.getNextJob()).toBeNull()

        await job.promoteWithTransaction();
        let nextJob = await userActor.coordinator.getNextJob()
        expect(nextJob.id).toEqual(job.id)
        expect(nextJob.status).toBe(JobStatus.ACTIVE)

    




        await testApplication.shutdown()
    });

    it('.process completed ', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let userCoodinator = userActor.coordinator;


        let jobOptions:JobOptions = {
            delay: 5000
        }

        mock.onGet('/test/job').reply(async()=>{ 
            return [200,{message:'test'}];
        })

        let job1 = new TestJob(userActor);
        await job1.create(jobOptions);
        await job1.promoteWithTransaction()

        let nextJob = await userCoodinator.getNextJob();

        await userCoodinator.processJob(nextJob);
        expect(await job1.getStatus()).toBe(JobStatus.COMPLETED);

        await testApplication.shutdown()
    });

    it('.process failed ', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let userCoodinator = userActor.coordinator;


        let jobOptions:JobOptions = {
            delay: 5000
        }

        mock.onGet('/test/job').reply(async()=>{ 
            return [500,{message:'test'}];
        })

        let job1 = new TestJob(userActor);
        await job1.create(jobOptions);
        await job1.promoteWithTransaction()

        let nextJob = await userCoodinator.getNextJob();

        await userCoodinator.processJob(nextJob);
        expect(await job1.getStatus()).toBe(JobStatus.FAILED);

        await testApplication.shutdown()
    });


    it('.close promise all process', async () => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let userCoodinator = userActor.coordinator;

        userCoodinator.concurrency = 2;//并发2

        let jobOptions:JobOptions = {
            delay: 5000
        }

        mock.onGet('/test/job').reply(async()=>{ 
            await timeout(200);//延迟200毫秒响应
            return [200,{message:123}];
        })

        let job1 = new TestJob(userActor);
        await job1.create(jobOptions);
        await job1.promoteWithTransaction()


        let job2 = new TestJob(userActor);

        await job2.create(jobOptions);
        await job2.promoteWithTransaction()

        let job3 = new TestJob(userActor);

        await job3.create(jobOptions);
        await job3.promoteWithTransaction()


        userCoodinator.run();
        await timeout(100);

        await userCoodinator.close();//关闭后立即检查数量
        expect(userCoodinator.processPromises.size).toBe(0)

        await testApplication.shutdown()
    })

    it('.concurrency success ', async (done) => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let userCoodinator = userActor.coordinator;

        userCoodinator.concurrency = 2;//并发2

        let jobOptions:JobOptions = {
            delay: 5000
        }

        mock.onGet('/test/job').reply(async()=>{ 
            await timeout(200);//延迟200毫秒响应
            return [200,{message:123}];
        })

        let job1 = new TestJob(userActor);
        await job1.create(jobOptions);
        await job1.promoteWithTransaction()


        let job2 = new TestJob(userActor);

        await job2.create(jobOptions);
        await job2.promoteWithTransaction()

        let job3 = new TestJob(userActor);

        await job3.create(jobOptions);
        await job3.promoteWithTransaction()

        userCoodinator.on(JobEventType.COMPLETED,async (job)=>{

            if(job.id.toHexString() == job3.id.toHexString()){
                await userActor.coordinator.close()
                await testApplication.shutdown()
                done()
            }
        })

        
        userCoodinator.run();
        await timeout(100);//等待从数据库取出job后，马上查询执行中job的数量
        expect(userCoodinator.processPromises.size).toBe(2);
    });

    it('.concurrency failed ', async (done) => {
        let testApplication = new TestApplication();
        await testApplication.init('ec_subtask');

        let userActor = testApplication.actorManager.get('user');
        let userCoodinator = userActor.coordinator;

        userCoodinator.concurrency = 2;//并发2

        let jobOptions:JobOptions = {
            delay: 5000
        }

        mock.onGet('/test/job').reply(async()=>{ 
            await timeout(200);//延迟200毫秒响应
            return [500,{message:123}];
        })

        let job1 = new TestJob(userActor);
        await job1.create(jobOptions);
        await job1.promoteWithTransaction()


        let job2 = new TestJob(userActor);

        await job2.create(jobOptions);
        await job2.promoteWithTransaction()

        let job3 = new TestJob(userActor);

        await job3.create(jobOptions);
        await job3.promoteWithTransaction()

        userCoodinator.on(JobEventType.FAILED,async (job)=>{

            if(job.id.toHexString() == job3.id.toHexString()){
                await userActor.coordinator.close()
                await testApplication.shutdown()
                done()
            }
        })

        
        userCoodinator.run();
        await timeout(100);//等待从数据库取出job后，马上查询执行中job的数量
        expect(userCoodinator.processPromises.size).toBe(2);
    });

});
