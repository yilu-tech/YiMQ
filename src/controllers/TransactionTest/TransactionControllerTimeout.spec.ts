import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../services';
import { RedisManager } from '../../handlers/redis';
import { CoordinatorDao } from '../../services/coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobStatus } from '../../services/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { TranscationJob } from '../../services/job/TranscationJob';
import { Coordinator } from '../../services/coordinator/Coordinator';
import { JobAdminController } from '../../admin/JobAdminController';
import { TransactionJobsSenderStatus } from '../../services/job/constants/TransactionJobSenderStatus';
import { TransactionJobItemStatus } from '../../services/job/constants/TransactionJobItemStatus';
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
describe('TransactionControllerTimeout', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let jobAdminController: JobAdminController;
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionControllerTimeout';
  let senderTransactionStatusUrl = 'http://test.service/transactions';
  let coordinator:Coordinator;
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
    coordinator = await coordinatorManager.get(coordinatorName);
    coordinator.processBootstrap();
  });
  afterAll(async()=>{
    // await coordinatorManager.close(coordinatorName);
  })




  /**
   * 任务提交后，超时超时后
   */
  describe('.timeout-check-status-failed-WAITING', () => {
    
    let beginRet;
    let beginBody = {
      "coordinator": coordinatorName,
      "name": "send_message",
      "delay": 100,
      "sender": {
        "name":"mix",
        "statusCheckUrl": senderTransactionStatusUrl,
        "header":{}
      }
    }
    it('begin a trasaction.', async () => {
      beginRet = await transactionController.begin(beginBody);//开启一个事物
      expect(beginRet.name).toBe(beginBody.name); //检查事物是否开启成功
    });

    //事物超时后去任务的发起方确认任务状态失败
    it('timeout failed get job status.', async (done) => {
        
      mock.onGet(senderTransactionStatusUrl).timeout();
      coordinator.getQueue().on('failed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.TIMEOUT)
          expect(updatedJob.context['failedReason']).toBe('timeout of 0ms exceeded');
          done();
        }
      });
    });
    //确认发起方状态为 等待状态，自动回滚
    it('timeout rollback get job status.', async (done) => {
      
      let updatedJob:TranscationJob = await coordinator.getJob(beginRet.id);
      
      mock.onGet(senderTransactionStatusUrl).reply(200,{
        status: TransactionJobsSenderStatus.BEGIN
      });
      await updatedJob.retry();
      coordinator.getQueue().on('completed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.ROLLBACKED)
          expect(updatedJob.statusCheckData.status).toBe(TransactionJobsSenderStatus.BEGIN);
          done();
        }
      });
    });
    
  });

  /**
   * 超时后远程获取状态，再提交事物
   */
  describe('.timeout-check-status-failed-COMMITED', () => {
    
    let beginRet;
    let beginBody = {
      "coordinator": coordinatorName,
      "name": "send_message",
      "delay": 100,
      "sender": {
        "name":"mix",
        "statusCheckUrl": senderTransactionStatusUrl,
        "header":{}
      }
    }
    it('begin a trasaction.', async () => {
      beginRet = await transactionController.begin(beginBody);//开启一个事物
      expect(beginRet.name).toBe(beginBody.name); //检查事物是否开启成功
    });
    //添加一个任务
    it('add a job-1.', async () => {
      let url = 'http://member.service/item-job-1';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id,
        "item":{
          "type":"wait",
          "url":url,
          "data":[
            {
              goods_id:'1',
              total:'1'
            }
          ]
        }
      }
      let result = await transactionController.jobs(jobBody); //创建子任务-1
      expect(result.id).toBe(1);//检查子任务-1 ID是否正确
    });
    //事物超时后，检查任务状态
    it('timeout failed get job status.', async (done) => {
        
      mock.onGet(senderTransactionStatusUrl).timeout();
      coordinator.getQueue().on('failed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.TIMEOUT)
          expect(updatedJob.context['failedReason']).toBe('timeout of 0ms exceeded');
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(0); //确认子任务尚未执行
          expect(updatedJob.items[0].status).toBe(TransactionJobItemStatus.PREPARED);//确认子任务状态
          done();
        }
      });
    });

    it('timeout rollback get job status.', async (done) => {
      
      let updatedJob:TranscationJob = await coordinator.getJob(beginRet.id);
      updatedJob.retry();
      //设置任务发起方任务已经提交
      mock.onGet(senderTransactionStatusUrl).reply(200,{
        status: TransactionJobsSenderStatus.COMMITED
      });
      coordinator.getQueue().on('completed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.COMMITED)
          expect(updatedJob.statusCheckData.status).toBe(TransactionJobsSenderStatus.COMMITED);
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(1); //子任务-1 已经成功，尝试次数1
          expect(updatedJob.items[0].status).toBe(TransactionJobItemStatus.CONFIRMED);//确认子任务已经完成
          done();
        }
      });
    });
    
  });

  /**
   * 事物超时后，向发起方确认事物处于回滚状态，确认子任务是否自动取消
   */
  describe('.timeout-check-status-failed-ROLLBACKED', () => {
    
    let beginRet;
    let beginBody = {
      "coordinator": coordinatorName,
      "name": "send_message",
      "delay": 100,
      "sender": {
        "name":"mix",
        "statusCheckUrl": senderTransactionStatusUrl,
        "header":{}
      }
    }
    it('begin a trasaction.', async () => {
      beginRet = await transactionController.begin(beginBody);//开启一个事物
      expect(beginRet.name).toBe(beginBody.name); //检查事物是否开启成功
    });

    it('add a job-1.', async () => {
      let url = 'http://member.service/item-job-1';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id,
        "item":{
          "type":"wait",
          "url":url,
          "data":[
            {
              goods_id:'1',
              total:'1'
            }
          ]
        }
      }
      let result = await transactionController.jobs(jobBody); //创建子任务-1
      expect(result.id).toBe(1);//检查子任务-1 ID是否正确
    });

    it('timeout failed get job status.', async (done) => {
        
      mock.onGet(senderTransactionStatusUrl).timeout();
      coordinator.getQueue().on('failed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.TIMEOUT)
          expect(updatedJob.context['failedReason']).toBe('timeout of 0ms exceeded');
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(0); 
          expect(updatedJob.items[0].status).toBe(TransactionJobItemStatus.PREPARED);
          done();
        }
      });
    });

    it('timeout get job remote status to rollback.', async (done) => {
      
      let updatedJob:TranscationJob = await coordinator.getJob(beginRet.id);
      updatedJob.retry();
      mock.onGet(senderTransactionStatusUrl).reply(200,{
        status: TransactionJobsSenderStatus.ROLLBACKED
      });
      coordinator.getQueue().on('completed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob:TranscationJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.ROLLBACKED)
          expect(updatedJob.statusCheckData.status).toBe(TransactionJobsSenderStatus.ROLLBACKED);
          expect(updatedJob.items[0].confirmAttemptsMade).toBe(0); //
          expect(updatedJob.items[0].cancelAttemptsMade).toBe(1); //
          expect(updatedJob.items[0].status).toBe(TransactionJobItemStatus.CANCELED); //
          done();
        }
      });
    });
    
  });


 




});
