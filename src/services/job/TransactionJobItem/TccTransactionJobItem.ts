import { TransactionJobItem } from "./TransactionJobItem";
import axios, { AxiosResponse } from 'axios';

import { TransactionJobItemAction } from "../constants/TransactionJobItemAction";
import { BadRequestException } from "@nestjs/common";
import { TransactionJobItemStatus } from "../constants/TransactionJobItemStatus";
export class TccTransactionJobItem extends TransactionJobItem{
    public tryResult: string|object;
    public tryFailedReason: any;
    public tryResponse:any;

    public async inited(){
        await this.try();
    }

    public async try(){
        try{
            //正常的成功，正常的失败都返回200
            this.action = TransactionJobItemAction.TRY;
            let result =  await axios.post(this.url,this.tojsonWithJob());
            this.tryResult = result.data;
            this.status = TransactionJobItemStatus.PREPARED;
            await this.update();
        }catch(error){
            this.tryResponse = {};
            this.tryFailedReason = error.message;

            this.status = TransactionJobItemStatus.PREPARE_FAILED;

            if(error.response){
                let response:AxiosResponse = error.response;
                this.tryResponse.status = response.status;
                this.tryResponse.data = response.data;
                this.tryResponse.requestHeader = response.config.headers
                
                if(response.status >= 500){ //执行方提交本地时候出现服务错误，协调器记录为 未知结果，关闭事物前需要确认状态
                    this.status = TransactionJobItemStatus.PREPARE_UNKNOWN
                }
                await this.update();//先更新，再throw,确保已经写入到redis
                throw new BadRequestException(this.tojsonWithJob());
            }

            await this.update();
            throw new BadRequestException(error.message);
        }
        
        
    }

    // public async commit(){
    //     console.log(`commit this item`);
    // }

    public async rollback(){
       
    }
    
}