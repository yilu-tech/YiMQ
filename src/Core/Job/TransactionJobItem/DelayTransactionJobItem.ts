import { TransactionJobItem } from "./TransactionJobItem";
import { TransactionJobItemStatus } from "../Constants/TransactionJobItemStatus";

export class DelayTransactionJobItem extends TransactionJobItem{

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