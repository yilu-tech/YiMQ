
import { Config } from '../config';
import { Injectable } from '@nestjs/common';
import { Coordinator } from './coordinator/Coordinator';
import { CoordinatorOptions } from './coordinator/CoordinatorOptions';
import { QueueCoordinator } from './coordinator/QueueCoordinator';
import { TransactionCoordinator } from './coordinator/TransactionCoordinator';
import { CoordinatorDao } from './coordinator/CoordinatorDao';
import { RedisManager } from '../handlers/redis/RedisManager';

@Injectable()
export class CoordinatorManager{
    private coordinators = {};
    constructor(public config:Config,public redisManager:RedisManager,private coordinatorDao:CoordinatorDao){
    }
    /**
     * 获取全部调度器
     */
    public list(){

    }
    /**
     * 获取调度器
     * @param name 
     */
    public get(name):any
    {
        return this.coordinators[name];
    }

    public async close(name):Promise<any>{
        if(this.coordinators[name]){
            let coordinator:Coordinator = this.coordinators[name];
            coordinator.close();
        }
    }

    /**
     * 创建调度器并记录到数据库
     * @param options
     */
    public async create(options){
        await this.coordinatorDao.add(options);
    }


    public async add(name,type,redisName){
        await this.coordinatorDao.add({
            type:type,
            name:name,
            redis:redisName
        })
    }

    /**
     * 从数据库恢复调度器，并进行监听
     */
    public async initCoordinators(){
        //初始化默认队列调度器
        if(!await this.coordinatorDao.exists('queue')){
            await this.coordinatorDao.add({redis:'default',type:'queue',name:'queue'})
        }
        //初始化默认事物调度器
        if(!await this.coordinatorDao.exists('transaction')){
            await this.coordinatorDao.add({redis:'default',type:'transaction',name:'transaction'})
        }
        var coordinatorsOptions = await this.coordinatorDao.all();
        //启动全部调度器
        for(var key in coordinatorsOptions){
            await this.bootstrapCoordinator(coordinatorsOptions[key]);
        }
        console.debug('Bootstrap coordinators.');
        
    }

        /**
     * 启动调度器
     * @param options 
     */
    private async bootstrapCoordinator(options:CoordinatorOptions){
        let coordinator = null;
        switch(options.type){
            case 'queue': {
                coordinator = new QueueCoordinator(this,options);
                break;
            }
            case 'transaction': {
                coordinator = new TransactionCoordinator(this,options);
                break;
            }
            default:{
                throw new Error(`Coordinator not support ${options.type}.`)
            }
        } 
        this.coordinators[options['name']] = coordinator;
    }


    public async bootstrapCoordinatorsProcesser(){
        for(let name in this.coordinators){
            let coordinator:Coordinator = this.coordinators[name];
            await coordinator.processBootstrap();
        }
    }
}