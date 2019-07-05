import { Job } from "./Job";
import { TransactionJobItem } from "./TransactionJobItem/TransactionJobItem";
import { BusinessException } from "../../Exceptions/BusinessException";
import { TransactionJobProcesser } from "./Processer/TransactionJobProcesser";
import { TccTransactionJobItem } from "./TransactionJobItem/TccTransactionJobItem";
import { DelayTransactionJobItem } from "./TransactionJobItem/DelayTransactionJobItem";
import { TransactionJobStatus } from "./Constants/TransactionJobStatus";
import { TransactionJobItemType } from "./Constants/TransactionJobItemType";

import { TransactionJobItemStatus } from "./Constants/TransactionJobItemStatus";
import { TransactionItemDto } from "../../Dto/TransactionDto";
// const timeout = ms => new Promise(res => setTimeout(res, ms))
export class TranscationJob extends Job{
    public total:number;
    public items: Array<TransactionJobItem> = [];
    public status: TransactionJobStatus;
    public statusCheckData:any;

    constructor(context){
        super(context);
        this.total = this.context.data.total ? this.context.data.total : 0;
        this.status = this.context.data.status;
        this.statusCheckData = this.context.data.statusCheckData;
        //将context.data中的items为TransactionJobItem，方便操作
        this.items = this.context.data.items.map((item)=>{
           return this.itemFactory(item,true);
        });

  
    }
    /**
     * Job 子任务构造器
     * @param item 
     */
    public itemFactory(item:TransactionItemDto,restore=false){
        let jobItem:TransactionJobItem;
        switch (item.type.toUpperCase()){
            case  TransactionJobItemType.DELAY:{
                jobItem =  new DelayTransactionJobItem(this);
                jobItem.type = TransactionJobItemType.DELAY;
                break;
            }
            case TransactionJobItemType.TCC:{
                jobItem =  new TccTransactionJobItem(this);
                jobItem.type = TransactionJobItemType.TCC;
                break;
            }
            default:{
                throw new BusinessException(`wrong transaction type: ${item.type}.`);
            }
        }

        if(restore){ //恢复的时候因为数据是干净的，直接合并对象
            Object.assign(jobItem,item);
        }else{
            jobItem.data = item.data;
            jobItem.url = item.url;
        }
     
        return jobItem;
    }
    /**
     * 添加子任务
     */
    public async addItem(item:TransactionItemDto):Promise<TransactionJobItem>{
        await this.isDelayedStatus();//判断状态，错误直接抛出异常
        let jobItem = this.itemFactory(item);

        jobItem.init(++this.total);//给事物子任务增加id.
        this.items.push(jobItem);
        await this.update();

        await jobItem.inited();
        return jobItem;
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
        if(!this.itemsIsPrepared()){
            throw new BusinessException(`Items of this transaction are not prepared.`);
        }
        await this.setStatus(TransactionJobStatus.COMMITED_WAITING);
        await this.context.promote();//取消延迟，进入队列执行
        return this;
    }

    public async setStatus(status:TransactionJobStatus):Promise<void>{
        this.status = status;
        await this.update();
    }
    /**
     * 回滚
     */
    public async rollback():Promise<TranscationJob>{
        await this.isDelayedStatus();
        await this.setStatus(TransactionJobStatus.ROLLABCK_WAITING);
        await this.context.promote();
        return this;
    }
    
    /**
     * 是否处于可以等待操作的状态
     */
    public async isDelayedStatus(){
        let contextStatus = await this.context.getState();
        if(contextStatus != 'delayed'){ //如果任何处于非等待状态，不能进行任何操作
            throw new BusinessException(`This transaction is already in the ${this.status} ${contextStatus}.`)
        }
        return true;
    }

    public itemsIsPrepared(){
        for(let item of  this.items){
            if(item.status != TransactionJobItemStatus.PREPARED){
                return false;
            }
        }
        return true;
    }

    public async process(){
        console.debug(`TransactionJob: <${this.name}> job-${this.id} will be process ${this.status || 'TIMEOUT'} action.`);
        let result = {"status":null};
        let processer = new TransactionJobProcesser(this);
        switch(this.status){
            case TransactionJobStatus.COMMITED_WAITING : {
                await processer.commit();
                break;
            }
            case TransactionJobStatus.ROLLABCK_WAITING : {
                await processer.rollback();
                break;
            }

            default:{
                await processer.timeout();
            }
        }
    }

    public toJson(){
        let json = super.toJson();
        json['items'] = this.items.map((item) => {
            return item.toJson();
        });
        return json;
    }
}