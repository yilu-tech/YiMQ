import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../Core/CoordinatorManager';
import { RedisManager } from '../../handlers/redis/RedisManager';
import { CoordinatorDao } from '../../Core/Coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobStatus } from '../../Core/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TranscationJob } from '../../Core/job/TranscationJob';
import { Coordinator } from '../../Core/Coordinator/Coordinator';
import { JobAdminController } from '../../admin/JobAdminController';
import { TransactionJobItemType } from '../../Core/job/constants/TransactionJobItemType';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
/**
 * 测试事物，在两个子任务的情况下，第二个子任务错误后，重新尝试的情况
 * 要点:
 * 1. 成功的子任务-1，是否会重复处理
 * 2. 失败的子任务-2，重新尝试后是否成功
 * 3. 失败后，后续的子任务-3是否会终止执行， 任务重新尝试后，是否会继续执行
 * 3. 任务在处理的过程中，增加子任务-4确保不会加入
 */
describe('TransactionTwoItemFailedRetry', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let jobAdminController: JobAdminController;
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionTwoItemFailedRetry';

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [TransactionController,JobAdminController],
      providers: [Config,RedisManager,CoordinatorDao,CoordinatorManager],
    }).compile();



    coordinatorManager = app.get<CoordinatorManager>(CoordinatorManager);
    coordinatorManager.add(coordinatorName,'transaction','default');
    await coordinatorManager.initCoordinators();

    transactionController = await app.get<TransactionController>(TransactionController);
    jobAdminController = await app.get<JobAdminController>(JobAdminController);
  });
  afterAll(async()=>{
    let coordinator:Coordinator =  await coordinatorManager.get(coordinatorName);
    await coordinator.getQueue().empty(); //移除未处理的任务
    await coordinatorManager.close(coordinatorName);
  })



   /**
    * 测试有两个子任务的事物，第一个成功，第二个失败
    */

  describe('.commit-job-one-succeed-one-failed', () => {
    let coordinator:Coordinator;
    let beginRet;
    let item_job_2 = 'http://member.service/item-job-2';
    let beginBody = {
      "coordinator": coordinatorName,
      "name": "send_message",
      "sender": {
        "name":"mix",
        "header":{}
      }
    }
    it('begin a trasaction.', async () => {
      coordinator = await coordinatorManager.get(beginBody.coordinator);
      beginRet = await transactionController.begin(beginBody);//开启一个事物
      expect(beginRet.name).toBe(beginBody.name); //检查事物是否开启成功

      coordinator.processBootstrap();//启动事物调度器
    });

    it('add a job-1.', async () => {
      let url = 'http://member.service/item-job-1';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": coordinatorName,
        "transaction_id":beginRet.id,
        "type":TransactionJobItemType.DELAY,
        "url":url,
        "data":[
          {
            goods_id:'1',
            total:'1'
          }
        ]
      }
      let result = await transactionController.jobs(jobBody); //创建子任务-1
      expect(result.id).toBe(1);//检查子任务-1 ID是否正确
    });


    it('add job-2.', async () => {
      mock.onPost(item_job_2).reply(()=>{
        return new Promise(async (resolve,reject)=>{
          await timeout(100); //延迟，测试任务在处理中的时候，添加子任务-2是否不成功
          resolve([400,{
            message : '余额不足'
          }])
        })
      });

      let jobBody = {
        "coordinator": coordinatorName,
        "transaction_id":beginRet.id,
        "type":TransactionJobItemType.DELAY,
        "url":item_job_2,
        "data":[
          {
            goods_id:'2',
            total:'2'
          }
        ]
      }
      
      let result = await transactionController.jobs(jobBody);//创建子任务-2
      expect(result.id).toBe(2);//检查子任务-2的ID是否正确
    });

    it('add a job-3.', async () => {
      let url = 'http://member.service/item-job-3';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": coordinatorName,
        "transaction_id":beginRet.id,
        "type":TransactionJobItemType.DELAY,
        "url":url,
        "data":[
          {
            goods_id:'1',
            total:'1'
          }
        ]
      }
      let result = await transactionController.jobs(jobBody); //创建子任务-3
      expect(result.id).toBe(3);//检查子任务-3 ID是否正确
    });



    it('start process with failed.', async (done) => {
    
      

      coordinator.getQueue().on('failed', async (job)=> {

        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(await updatedJob.context.getState()).toBe('failed');
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(1); //子任务-1 尝试一次 成功
          expect(updatedJob.items[1].confirmAttemptsMade).toBe(1); //子任务-2 尝试一次，失败
          expect(updatedJob.items[2].confirmAttemptsMade).toBe(0); //子任务-3 未尝试
          done();
        }
      });

      let commitBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      };
      let commitRet= await transactionController.commit(commitBody);//提交事物
      expect(commitRet.status).toBe(TransactionJobStatus.COMMITED_WAITING);//检查事物是否提交成功

      let url = 'http://member.service/item-job-4';
      let jobBody = {
        "coordinator": coordinatorName,
        "transaction_id":beginRet.id,
        "type":TransactionJobItemType.DELAY,
        "url":url,
        "data":[]
      }

      try{
        await transactionController.jobs(jobBody); //创建子任务-3
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobStatus.COMMITED_WAITING} active.`)
      }
      
    });

    it('retry process with completed.', async (done) => {
        
      mock.onPost(item_job_2).reply(200,{
      });
      coordinator.getQueue().on('completed', async (job)=> {
    
        if (job.id == beginRet.id) {

          let updatedJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.COMMITED);
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(1); //子任务-1 已经成功，尝试次数1
          expect(updatedJob.items[1].confirmAttemptsMade).toBe(2); //子任务-2 第二次尝试，成功
          expect(updatedJob.items[2].confirmAttemptsMade).toBe(1); //子任务-3 第一次尝试，成功
          done();
        }
      });

      let retryQuery = {
        coordinator:beginBody.coordinator,
        id: beginRet.id
      }
      await jobAdminController.retry(retryQuery);
    });
  });

    


});
