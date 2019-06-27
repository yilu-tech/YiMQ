import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../services';
import { RedisManager } from '../../handlers/redis';
import { CoordinatorDao } from '../../services/coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobItemStatus } from '../../services/job/constants/TransactionJobItemStatus';
import { TransactionJobStatus } from '../../services/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Coordinator } from '../../services/coordinator/Coordinator';
import { TransactionJobAction } from '../../services/job/constants/TransactionJobAction';
import { TranscationJob } from '../../services/job/TranscationJob';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('TransactionController', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let coordinatorManager: CoordinatorManager

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [Config,RedisManager,CoordinatorDao,CoordinatorManager],
    }).compile();

    coordinatorManager = app.get<CoordinatorManager>(CoordinatorManager);
    await coordinatorManager.initCoordinators();
    transactionController = await app.get<TransactionController>(TransactionController);
  });

  afterAll(async()=>{
    let coordinator:Coordinator =  await coordinatorManager.get('transaction');
    await coordinator.getQueue().empty(); //移除未处理的任务
  })


  /**
   * 开启一个事物，提交后
   * 1. 提交是否成功
   * 2. 是否不能再添加子任务
   * 3. 是否不能再回滚
   */
  describe('.begin-commit', () => {
    let beginRet;
    it('begin a trasaction.', async () => {
      let beginBody = {
        "coordinator": "transaction",
        "name": "send_message",
        "sender": {
          "name":"mix",
          "header":{}
        }
      }
      beginRet = await transactionController.begin(beginBody);
      expect(beginRet.name).toBe(beginBody.name);
    });

    it('commit a trasaction.', async () => {
      let commitBody = {
        "coordinator": "transaction",
        "id":beginRet.id
      }
      let commitRet= await transactionController.commit(commitBody);
      expect(commitRet.action).toBe(TransactionJobAction.COMMIT);
    });

    it('add a job to trasaction.', async () => {
      let url = 'http://member.service/pay';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": "transaction",
        "id":beginRet.id,
        "item":{
          "type":"wait",
          "url":url,
          "data":[
            {
              goods_id:'234213124123',
              total:'21'
            }
          ]
        }
      }
      try{
        let result = await transactionController.jobs(jobBody);
      }catch(error){
        expect(error.message.message).toBe('This transaction is already in the COMMIT waiting.');
      }
      
    });

    it('rollback a trasaction.', async () => {
      let rollbackBody = {
        "coordinator": "transaction",
        "id":beginRet.id
      }
      try{
        await transactionController.rollback(rollbackBody);
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobAction.COMMIT} waiting.`);
      }
    });
    
  });
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
        "coordinator": "transaction",
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
        "coordinator": "transaction",
        "id":beginRet.id
      }
      let ret = await transactionController.rollback(rollbackBody);
      expect(ret.action).toBe(TransactionJobAction.ROLLBACK);
    });

    it('add a job to trasaction.', async () => {
      let url = 'http://member.service/pay';
      mock.onPost(url).reply(200,{
        stock_change_log_id : 2656
      });
      let jobBody = {
        "coordinator": "transaction",
        "id":beginRet.id,
        "item":{
          "type":"wait",
          "url":url,
          "data":[
            {
              goods_id:'234213124123',
              total:'21'
            }
          ]
        }
      }
      try{
        let result = await transactionController.jobs(jobBody);
      }catch(error){
        expect(error.message.message).toBe('This transaction is already in the ROLLBACK waiting.');
      }
      
    });

    it('commit a trasaction.', async () => {
      let commitBody = {
        "coordinator": "transaction",
        "id":beginRet.id
      }
      try{
        let commitRet= await transactionController.commit(commitBody);
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobAction.ROLLBACK} waiting.`);
      }
    });
  });
});
