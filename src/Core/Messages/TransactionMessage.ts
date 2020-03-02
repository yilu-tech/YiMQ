import { Message } from "./Message";
import { TransactionJob } from "../Job/TransactionJob";
import { JobType } from "../../Constants/JobConstants";


export class TransactionMessage extends Message{ 
    items:Map<Number,{}>;  //事物的子项目




    async done(){
        //1. 设置MessageStatus = done
        //2. 创建items的job
        //3. 删除MessageJob

    }

    async cancel(){
        //1. 设置MessageStatus = cancel
        //2. 创建items的job
        //3. 删除MessageJob
    }
}