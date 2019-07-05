import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../Services/CoordinatorManager';
import { RedisManager } from '../../handlers/redis/RedisManager';
import { CoordinatorDao } from '../../Services/Coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobStatus } from '../../Services/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Coordinator } from '../../Services/Coordinator/Coordinator';
import { JobAdminController } from '../../admin/JobAdminController';
import { TransactionJobItemStatus } from '../../Services/job/constants/TransactionJobItemStatus';
import { TransactionJobItemType } from '../../Services/job/constants/TransactionJobItemType';
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
describe('TransactionTccTryFailedCommit', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let jobAdminController: JobAdminController;
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionTccTryFailedCommit';
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
      "delay": 1000,
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
   
    it('add a tcc-job-item-1.', async () => {
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
        let jobItemResult = error.response.message;
        expect(jobItemResult.id).toBe(1);//检查子任务-1 ID是否正确
        expect(jobItemResult.status).toBe(TransactionJobItemStatus.PREPARE_FAILED); //检查子任务try状态
      }
    });

    it('items-not-all-preared-to-commit',async()=>{

      let url = 'http://try.test';
      mock.onPost(url).reply(200,'succeed');

      let commitBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      };
      try {
        let commitRet= await transactionController.commit(commitBody);//提交事物
        expect(commitRet.action).toBe(TransactionJobStatus.COMMITED_WAITING);//检查事物是否提交成功
      } catch (error) {
        expect(error.message.message).toBe(`Items of this transaction are not prepared.`);//检查事物是否提交成功
      }


    })

   
    
  });



 




});
