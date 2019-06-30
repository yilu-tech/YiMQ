import { IsDefined,ValidateNested,IsNumber } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionJobItem } from '../services/job/TransactionJobItem/TransactionJobItem';

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
    id:string;

    @ValidateNested()
    @Type(()=>TransactionItemDto)
    item:TransactionItemDto;
}



