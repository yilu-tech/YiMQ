import { Job } from "./Job";
import { TransactionJobItem } from "./TransactionJobItem/TransactionJobItem";
import * as bull from 'bull';
import { BusinessException } from "../../Exceptions/BusinessException";
import { TransactionJobProcesser } from "./processer/TransactionJobProcesser";
import { TccTransactionJobItem } from "./TransactionJobItem/TccTransactionJobItem";
import { WaitTransactionJobItem } from "./TransactionJobItem/WaitTransactionJobItem";
import { TransactionJobStatus } from "./constants/TransactionJobStatus";
import { TransactionJobAction } from "./constants/TransactionJobAction";
import Axios from "axios";
import { TransactionJobsSenderStatus } from "./constants/TransactionJobSenderStatus";
const timeout = ms => new Promise(res => setTimeout(res, ms))
export class TranscationJob extends Job{
    public total:number;
    public items: Array<TransactionJobItem> = [];
    public action: String;
    public statusCheckData:any;

    constructor(context){
        super(context);
        this.total = this.context.data.total ? this.context.data.total : 0;
        this.action = this.context.data.action;
        this.statusCheckData = this.context.data.statusCheckData;
        //将context.data中的items为TransactionJobItem，方便操作
        this.items = this.context.data.items.map((item)=>{
           return this.itemFactory(item);
        });

  
    }
    /**
     * Job 子任务构造器
     * @param item 
     */
    public itemFactory(item){
        let job:TransactionJobItem;
        switch (item.type){
            case  'wait':{
                job =  Object.assign(new WaitTransactionJobItem(this),item);
                break;
            }
            case 'tcc':{
                job =  Object.assign(new TccTransactionJobItem(this),item);
                break;
            }
            default:{
                throw new BusinessException(`wrong transaction type: ${item.type}.`);
            }
        }
        return job;
    }
    /**
     * 添加子任务
     */
    public async addItem(item:Object):Promise<TranscationJob>{
        await this.isDelayedStatus();//判断状态，错误直接抛出异常
        let job = this.itemFactory(item);
        job.init(++this.total);//给事物子任务增加id.
        this.items.push(job);
        await this.update();
        return this;
    }
    public async addItemTccJob(){

    }

    /**
     * 更新
     */
    public async update(){
        return this.context.update(this.toJson());
    }
    /**
     * 提交
     */
    public async commit():Promise<TranscationJob>{
        await this.isDelayedStatus();
        await this.setAction(TransactionJobAction.COMMIT);
        await this.context.promote();
        return this;
    }

    public async setAction(action:TransactionJobAction):Promise<void>{
        this.action = action;
        await this.update();
    }
    /**
     * 回滚
     */
    public async rollback():Promise<TranscationJob>{
        await this.isDelayedStatus();
        await this.setAction(TransactionJobAction.ROLLBACK);
        await this.context.promote();
        return this;
    }
    
    /**
     * 是否处于可以等待操作的状态
     */
    public async isDelayedStatus(){
        let contextStatus = await this.context.getState();
        if(contextStatus != 'delayed'){ //如果任何处于非等待状态，不能进行任何操作
            throw new BusinessException(`This transaction is already in the ${this.action} ${contextStatus}.`)
        }
        return true;
    }

    public async process(){
        console.debug(`TransactionJob: <${this.name}> job-${this.id} will be process ${this.action || 'TIMEOUT'} action.`);
        let result = {"status":null};
        let processer = new TransactionJobProcesser(this);
        switch(this.action){
            case TransactionJobAction.COMMIT : {
                await processer.commit();
                result.status = TransactionJobStatus.COMMITED;
                break;
            }
            case TransactionJobAction.ROLLBACK : {
                await processer.rollback();
                result.status = TransactionJobStatus.ROLLBACKED;
                break;
            }

            default:{
                await processer.timeout();
                result.status = TransactionJobStatus.TIMEOUT;
            }
        }
        return result;
    }

    public toJson(){
        let json = super.toJson();
        json['items'] = this.items.map((item) => {
            return item.toJson();
        });
        return json;
    }
}