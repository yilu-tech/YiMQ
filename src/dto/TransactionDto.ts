import { IsDefined,ValidateNested,IsNumber } from 'class-validator';

export class CreateTransactionMessageDto{
    @IsDefined()
    actor:string;
    @IsDefined()
    topic:string;
}

export class TransactionItemDto{
    @IsDefined()
    type:string;
    @IsDefined()
    url:string;
    data:object;
}

export class AddTransactionItemDto{
    @IsDefined()
    coordinator:string;
    @IsDefined()
    transaction_id:string;

    @IsDefined()
    type:string;
    @IsDefined()
    url:string;
    data:any;
}



