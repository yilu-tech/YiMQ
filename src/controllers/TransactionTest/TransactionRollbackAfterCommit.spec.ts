import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../services';
import { RedisManager } from '../../handlers/redis/RedisManager';
import { CoordinatorDao } from '../../services/coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobStatus } from '../../services/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Coordinator } from '../../services/coordinator/Coordinator';
import { TranscationJob } from '../../services/job/TranscationJob';
import { TransactionJobItemType } from '../../services/job/constants/TransactionJobItemType';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('TransactionRollbackAfterCommit', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionRollbackAfterCommit';

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [Config,RedisManager,CoordinatorDao,CoordinatorManager],
    }).compile();

    coordinatorManager = app.get<CoordinatorManager>(CoordinatorManager);
    coordinatorManager.add(coordinatorName,'transaction','default');
    await coordinatorManager.initCoordinators();
    transactionController = await app.get<TransactionController>(TransactionController);
  });

  afterAll(async()=>{
    // let coordinator:Coordinator =  await coordinatorManager.get(coordinatorName);
    // await coordinator.getQueue().empty(); //移除未处理的任务
    // await coordinatorManager.close(coordinatorName);
  })


  /**
   * 开启一个事物，回滚后
   * 1. 是否成功进入回滚动作
   * 2. 是否不能再添加子任务
   * 3. 是否不能再commit
   */
  describe('.begin-rollback-commit', () => {
    let beginRet;
    it('begin a trasaction.', async () => {
      let beginBody = {
        "coordinator": coordinatorName,
        "name": "send_message",
        "sender": {
          "name":"mix",
          "header":{}
        }
      }
      beginRet = await transactionController.begin(beginBody);
      expect(beginRet.name).toBe(beginBody.name);
    });

    it('rollback a trasaction.', async () => {

      let rollbackBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      }
      let ret = await transactionController.rollback(rollbackBody);
      expect(ret.status).toBe(TransactionJobStatus.ROLLABCK_WAITING);
    });

    it('add a job to trasaction.', async () => {
      let url = 'http://member.service/pay';
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
            goods_id:'234213124123',
            total:'21'
          }
        ]
      }
      try{
        let result = await transactionController.jobs(jobBody);
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobStatus.ROLLABCK_WAITING} waiting.`);
      }
      
    });

    it('commit a trasaction.', async () => {
      let commitBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      }
      try{
        let commitRet= await transactionController.commit(commitBody);
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobStatus.ROLLABCK_WAITING} waiting.`);
      }
    });
  });
});
