import { Test, TestingModule } from '@nestjs/testing';
import {ActorController} from '../ActorController';

import { RedisManager } from '../../handlers/redis/RedisManager';
import { Config } from '../../config';
import { ModelFactory } from '../../handlers/ModelFactory';
import { RedisDao } from '../../handlers/redis/ReidsDao';
import { ActorService } from '../../Services/ActorService';


describe('ActorController', () => {
  let app: TestingModule;
  let actorController:ActorController;
  let redisManager:RedisManager;

  beforeAll(async () => {
    app = await Test.createTestingModule({
      controllers: [ActorController],
      providers: [Config,RedisManager,RedisDao,ModelFactory,ActorService],
    }).compile();

    actorController = await app.get<ActorController>(ActorController);
    redisManager = await app.get<RedisManager>(RedisManager);
    redisManager.client().flushdb();
  });

  afterAll(async()=>{
  })

  describe('.create.success', async () => {
    let actor_1 = `actor-1`;
    let actor_2 = `actor-2`;

    it('.add actor-1', async () => {
        let body = {
            "name": actor_1,
            "api": "http://internal.test/staff/transaction"
        };
        let result = await actorController.create(body);
        expect(result.name).toBe(body.name);//检查子任务-1 ID是否正确
    });

    it('.add actor-1', async () => {
        let body = {
            "name": actor_1,
            "api": "http://internal.test/staff/transaction"
        };
        let errorMessage;
        try {
            let result = await actorController.create(body);
   
        } catch (error) {
            errorMessage = error.message;  
        } finally{
            expect(errorMessage).toBe(`actors of name ${actor_1} is exist.`);//检查子任务-1 ID是否正确  
        }
        
        
    });

    it('.add actor-2', async () => {
        let body = {
            "name": actor_2,
            "api": "http://internal.test/staff/transaction"
        };
        let result = await actorController.create(body);
        expect(result.name).toBe(body.name);//检查子任务-1 ID是否正确
    });

    it('.get all actor', async () => {
       
        let items = await actorController.all();
        expect(items.length).toBe(2);//检查子任务-1 ID是否正确
    });

    it('.update actor-2',async ()=>{
        let params = {
            name: actor_2,
        }
        let body = {
            api: "http://internal.test/staff/transaction-change"
        }
        let result = await actorController.update(params,body);
        expect(result).toBe(true);
    })

    it('.delete actor-1',async ()=>{
        let params = {
            name: actor_1
        }
        let result = await actorController.delete(params);
        expect(result).toBe(true);
    })
  });
  


});
