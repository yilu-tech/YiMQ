import { Message } from "./Message";
import { TransactionJob } from "../Job/TransactionJob";
import { JobType } from "../../Constants/JobConstants";
import { MessageStatus } from "../../Constants/MessageConstants";


export class TransactionMessage extends Message{ 
    items:Map<Number,{}>;  //事物的子项目




    async done():Promise<Message>{
        
        //TODO
        //1. 创建items的job
        
        this.status = MessageStatus.DOING;//2. 修改message状态
        await this.update();
        return this;
        
    }
    async confirm():Promise<Message>{
        this.done();
        await this.job.remove();//删除MessageJob (放在this.done后，如果1、2操作失败,job可以保证重新检查)
        return this;
    }

    async cancel():Promise<Message>{
        //TODO
        //1. 设置MessageStatus = cancel
        //2. 创建items的job
        //3. 删除MessageJob
        return this.update();
    }
}