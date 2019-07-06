import { Test, TestingModule } from '@nestjs/testing';
import { TransactionController } from '../TransactionController';
import { CoordinatorManager } from '../../Core/CoordinatorManager';
import { RedisManager } from '../../handlers/redis/RedisManager';
import { CoordinatorDao } from '../../Core/Coordinator/CoordinatorDao';
import { Config } from '../../config';
import { TransactionJobStatus } from '../../Core/job/constants/TransactionJobStatus';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { Coordinator } from '../../Core/Coordinator/Coordinator';
import { TranscationJob } from '../../Core/job/TranscationJob';
import { TransactionJobItemType } from '../../Core/job/constants/TransactionJobItemType';
import {TransactionService} from '../../Services/TransactionService';
const mock = new MockAdapter(axios);
const timeout = ms => new Promise(res => setTimeout(res, ms))
describe('TransactionCommitAfterRollback', () => {
  let app: TestingModule;
  let transactionController :TransactionController
  let coordinatorManager: CoordinatorManager
  let coordinatorName = 'TransactionCommitAfterRollback';

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [TransactionController],
      providers: [Config,RedisManager,CoordinatorDao,CoordinatorManager,TransactionService],
    }).compile();

    coordinatorManager = app.get<CoordinatorManager>(CoordinatorManager);
    coordinatorManager.add(coordinatorName,'transaction','default');
    await coordinatorManager.initCoordinators();
    transactionController = await app.get<TransactionController>(TransactionController);
  });

  afterAll(async()=>{
    let coordinator:Coordinator =  await coordinatorManager.get(coordinatorName);
    await coordinator.getQueue().empty(); //移除未处理的任务
    await coordinatorManager.close(coordinatorName);
  })


  /**
   * 开启一个事物，提交后
   * 1. 提交是否成功
   * 2. 是否不能再添加子任务
   * 3. 执行提交后，状态是否正确
   * 3. 执行提交后，是否不能再回滚
   */
  describe('.begin-commit', () => {
    let coordinator:Coordinator;
    let beginRet;
    it('begin a trasaction.', async () => {
      let beginBody = {
        "coordinator": coordinatorName,
        "name": "send_message",
        "delay": 1000,
        "sender": {
          "name":"mix",
          "header":{}
        }
      }
      coordinator = await coordinatorManager.get(beginBody.coordinator);
      beginRet = await transactionController.begin(beginBody);
      expect(beginRet.name).toBe(beginBody.name);
    });
    //提交是否成功
    it('commit a trasaction.', async () => {
      let commitBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      }
      let commitRet= await transactionController.commit(commitBody);
      expect(commitRet.status).toBe(TransactionJobStatus.COMMITED_WAITING);
    });
    //是否不能再添加子任务
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
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobStatus.COMMITED_WAITING} waiting.`);
      }
      
    });
    //执行提交后，状态是否正确
    it('process a trasaction.', async (done) => {

      coordinator.getQueue().on('completed', async (job)=> {
    
        if (job.id == beginRet.id) {
          let updatedJob = await coordinator.getJob(job.id);//重新查询任务，检查子任务状态是否正确
          expect(updatedJob.status).toBe(TransactionJobStatus.COMMITED)
          done();
        }
      });

      coordinator.processBootstrap();//启动事物调度器
    });
    //执行提交后，是否不能再回滚
    it('rollback a trasaction.', async () => {

      let rollbackBody = {
        "coordinator": coordinatorName,
        "id":beginRet.id
      }
      try{
        await transactionController.rollback(rollbackBody);
      }catch(error){
        expect(error.message.message).toBe(`This transaction is already in the ${TransactionJobStatus.COMMITED} completed.`);
      }
    });
    
  });
});
