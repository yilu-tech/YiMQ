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
import { TransactionJobsSenderStatus } from '../../Core/job/constants/TransactionJobSenderStatus';
import { TransactionJobItemStatus } from '../../Core/job/constants/TransactionJobItemStatus';
import { TransactionJobItemType } from '../../Core/job/constants/TransactionJobItemType';
import {TransactionService} from '../../Services/TransactionService';
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
describe('TransactionTccTryFailedTimeoutCommit', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let jobAdminController: JobAdminController;
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionTccTryFailedTimeoutCommit';
  let senderTransactionStatusUrl = 'http://test.service/transactions';
  let coordinator:Coordinator;
  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [TransactionController,JobAdminController],
      providers: [Config,RedisManager,CoordinatorDao,CoordinatorManager,TransactionService],
    }).compile();



    coordinatorManager = app.get<CoordinatorManager>(CoordinatorManager);
    coordinatorManager.add(coordinatorName,'transaction','default');
    await coordinatorManager.initCoordinators();

    transactionController = await app.get<TransactionController>(TransactionController);
    jobAdminController = await app.get<JobAdminController>(JobAdminController);
    coordinator = await coordinatorManager.get(coordinatorName);
  });
  afterAll(async()=>{
    let coordinator:Coordinator =  await coordinatorManager.get(coordinatorName);
    await coordinator.getQueue().empty(); //移除未处理的任务
    await coordinatorManager.close(coordinatorName);
  })





  /**
   * 测试tcc try失败
   */
  describe('.test-tcc-try-faild', () => {
    
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
   
    it('add a tcc-job-item-1-try-failed.', async () => {
      let url = 'http://try.test';
      mock.onPost(url).reply(400,{
        error:'stock_not_enough'
      });

      let jobBody = {
        "coordinator": coordinatorName,
        "transaction_id":beginRet.id,
        "type":TransactionJobItemType.TCC,
        "url":url,
        "data":[
          {
            goods_id:'1',
            total:'1'
          }
        ]
      }
      try{
        let result = await transactionController.jobs(jobBody); //创建子任务-1
      }catch(error){
        let jobItemResult = error.response;
        expect(jobItemResult.id).toBe(1);//检查子任务-1 ID是否正确
        expect(jobItemResult.status).toBe(TransactionJobItemStatus.PREPARE_FAILED); //检查子任务try状态
      }
    });

    it('.timeout-remote-commited-to-commit',async(done)=>{

      mock.onGet(senderTransactionStatusUrl).reply(200,{
        status: TransactionJobsSenderStatus.COMMITED
      });

      coordinator.getQueue().on('failed', async (job)=> {
        if (job.id == beginRet.id) {
          let updatedJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.TIMEOUT)
          done();
        }
      });

      coordinator.processBootstrap();//启动事物调度器

    })

   
    
  });

});
