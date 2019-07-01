import axios, { AxiosResponse } from 'axios';
import { TransactionJobItemStatus } from '../constants/TransactionJobItemStatus';
import { TranscationJob } from '../TranscationJob';
import { TransactionJobItemAction } from '../constants/TransactionJobItemAction';

export abstract class TransactionJobItem{
    public id:number;
    public type:string;
    public url:string;
    public action:TransactionJobItemAction
    public status:TransactionJobItemStatus;
    
    public confirmAttemptsMade:number;
    public confirmResult: string|object;

    public cancelAttemptsMade:number;
    public failedReason: any;
    
    public data:object;
    constructor(public job:TranscationJob){

    }

    public init(id){
        this.id = id;
        this.status = TransactionJobItemStatus.PREPARING;
        this.confirmAttemptsMade = 0;
        this.cancelAttemptsMade = 0;
    }

    public async update(){
        await this.job.update();
    }

    public abstract async inited();

    public async commit(){
        ++this.confirmAttemptsMade;
        this.action = TransactionJobItemAction.CONFIRM;
        try{
            let result =  await axios.post(this.url,this.data);
            this.confirmResult = result.data;
            this.status = TransactionJobItemStatus.CONFIRMED;
        }catch(error){
            this.failedReason = {};
            this.status = TransactionJobItemStatus.CONFIRM_FAILED;
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

    public tojsonWithJob(){
        let json = this.toJson();
        let job = this.job.toJson();
        delete job['items'];
        json['job'] = job;
        return json;
    }
}