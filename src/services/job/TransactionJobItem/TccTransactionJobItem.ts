import { TransactionJobItem } from "./TransactionJobItem";

export class TccTransactionJobItem extends TransactionJobItem{
    public async commit(){
        console.log('------>',this)
        console.log(`commit this item`);
    }
    
}