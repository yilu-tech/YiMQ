import axios, { AxiosResponse } from 'axios';
import { TransactionJobItemStatus } from '../constants/TransactionJobItemStatus';
import { TranscationJob } from '../TranscationJob';

export abstract class TransactionJobItem{
    public id:number;
    public type:string;
    public url:string;
    public status:TransactionJobItemStatus;
    public failedReason: any;
    public returnValue: string|object;
    public attemptsMade:number;
    public data:object;
    constructor(public job:TranscationJob){

    }

    public init(id){
        this.id = id;
        this.status = TransactionJobItemStatus.WAITING;
        this.attemptsMade = 0;
    }

    public async update(){
        await this.job.update();
    }

    public async commit(){
        ++this.attemptsMade;
        try{
            let result =  await axios.post(this.url,this.data);
            this.returnValue = result.data;
            this.status = TransactionJobItemStatus.COMPLETED;
        }catch(error){
            this.failedReason = {};
            this.status = TransactionJobItemStatus.FAILED;
            this.failedReason.message = error.message;
            
            if('response' in error){
                let response:AxiosResponse = error.response;
                this.failedReason.data = response.data;
            }
            await this.update();
            throw error;
        }
        
        await this.update();
    }
    abstract async rollback();

    /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['job'];
        return json;
    }
}