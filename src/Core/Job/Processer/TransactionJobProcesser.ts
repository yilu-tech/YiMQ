import { JobProcesser } from "./JobProcesser";
import { TranscationJob } from "../TranscationJob";
import { TransactionJobItem } from "../TransactionJobItem/TransactionJobItem";
import { TransactionJobItemStatus } from "../Constants/TransactionJobItemStatus";
import Axios from "axios";
import { TransactionJobsSenderStatus } from "../Constants/TransactionJobSenderStatus";
import { TransactionJobStatus } from "../Constants/TransactionJobStatus";


export class TransactionJobProcesser extends JobProcesser{
    constructor(protected job:TranscationJob){
        super();
    }

    public async commit(){
        for(let item of  this.job.items){
            //提交 jobItem状态为 PREPARED 和 CONFIRMED_FAILED的子任务
            if(item.status == TransactionJobItemStatus.PREPARED || item.status == TransactionJobItemStatus.CONFIRM_FAILED){//处于等待状态
                await item.commit();
            }
        }
        await this.job.setStatus(TransactionJobStatus.COMMITED);
    }

    public async rollback(){
        for(let item of  this.job.items){
            if(item.status == TransactionJobItemStatus.PREPARED || item.status == TransactionJobItemStatus.CANCEL_FAILED){//处于等待状态
                await item.rollback();
            }
        }
        await this.job.setStatus(TransactionJobStatus.ROLLBACKED);
    }

    public async timeout(){
        try{
            await this.job.setStatus(TransactionJobStatus.TIMEOUT);
            //向发起者询问状态
            let result = await Axios.get(this.job.sender.statusCheckUrl,{params:{id:this.job.id}});

            this.job.statusCheckData = result.data;
            switch(this.job.statusCheckData.status){
                case TransactionJobsSenderStatus.BEGIN: {
                    await this.job.setStatus(TransactionJobStatus.ROLLABCK_WAITING);
                    await this.rollback();
                    break;
                }
                case TransactionJobsSenderStatus.COMMITED: {
                    if(!this.job.itemsIsPrepared()){
                        throw new Error('Items of this transaction are not prepared.');
                    }
                    await this.job.setStatus(TransactionJobStatus.COMMITED_WAITING);
                    await this.commit();
                    break;
                }
                case TransactionJobsSenderStatus.ROLLBACKED: {
                    await this.job.setStatus(TransactionJobStatus.ROLLABCK_WAITING);
                    await this.rollback();
                    break;
                }
            }

   
        }catch(error){
            throw error;
        }

    }
}