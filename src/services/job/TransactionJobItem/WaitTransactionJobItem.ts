import { TransactionJobItem } from "./TransactionJobItem";
import { TransactionJobItemStatus } from "../constants/TransactionJobItemStatus";

export class WaitTransactionJobItem extends TransactionJobItem{
    public async rollback(){
        ++this.attemptsMade;
        this.status = TransactionJobItemStatus.CANCELED;
        await this.update();
    }
    
}