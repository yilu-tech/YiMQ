import { Message } from "./Message";
import { TransactionJob } from "../Job/TransactionJob";
import { JobType } from "../../Constants/JobConstants";


export class TransactionMessage extends Message{ 
    items:Map<Number,{}>;  //事物的子项目




    commit(){

    }

    rollback(){

    }
}