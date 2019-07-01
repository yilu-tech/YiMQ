import { TransactionJobItem } from "./TransactionJobItem";
import { TransactionJobItemStatus } from "../constants/TransactionJobItemStatus";

export class WaitTransactionJobItem extends TransactionJobItem{

    public async inited(){
        this.status = TransactionJobItemStatus.PREPARED;
        await this.update();
    }
    public async rollback(){
        ++this.cancelAttemptsMade;
        this.status = TransactionJobItemStatus.CANCELED;
        await this.update();
    }
    
}