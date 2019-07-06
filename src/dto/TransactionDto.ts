import { IsDefined,ValidateNested,IsNumber } from 'class-validator';

export class CreateTransactionDto{
    @IsDefined()
    coordinator:string;
    @IsDefined()
    name:string;
    
    // @IsNumber()
    // delay:Number;
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



