import { JobProcesser } from "./JobProcesser";
import { TranscationJob } from "../TranscationJob";
import { TransactionJobItem } from "../TransactionJobItem/TransactionJobItem";
import { TransactionJobItemStatus } from "../constants/TransactionJobItemStatus";
import Axios from "axios";
import { TransactionJobsSenderStatus } from "../constants/TransactionJobSenderStatus";
import { BusinessException } from "../../../Exceptions/BusinessException";
import { TransactionJobAction } from "../constants/TransactionJobAction";


export class TransactionJobProcesser extends JobProcesser{
    constructor(protected job:TranscationJob){
        super();
    }

    public async commit(){
        for(let item of  this.job.items){
            if(item.status == TransactionJobItemStatus.WAITING || item.status == TransactionJobItemStatus.FAILED){//处于等待状态
                await item.commit();
            }
        }
    }

    public async rollback(){
        for(let item of  this.job.items){
            if(item.status == TransactionJobItemStatus.WAITING || item.status == TransactionJobItemStatus.FAILED){//处于等待状态
                await item.rollback();
            }
        }
    }

    public async timeout(){
        try{
            let result = await Axios.get(this.job.sender.statusCheckUrl,{params:{id:this.job.id}});

            this.job.statusCheckData = result.data;
            switch(this.job.statusCheckData.status){
                case TransactionJobsSenderStatus.WAITING: {
                    this.job.setAction(TransactionJobAction.ROLLBACK);
                    await this.rollback();
                    break;
                }
                case TransactionJobsSenderStatus.COMMITED: {
                    this.job.setAction(TransactionJobAction.COMMIT);
                    await this.commit();
                    break;
                }
                case TransactionJobsSenderStatus.ROLLBACKED: {
                    this.job.setAction(TransactionJobAction.ROLLBACK);
                    await this.rollback();
                    break;
                }
            }

   
        }catch(error){
            throw error;
        }

    }
}