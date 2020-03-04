import { Message } from "./Message";
import { MessageStatus } from "../../Constants/MessageConstants";


export class TransactionMessage extends Message{ 
    items:Map<Number,{}>;  //事物的子项目




    async statusToDoing():Promise<Message>{
        this.status = MessageStatus.DOING;
        await this.update();
        return this;
        
    }

    async statusToCancelling(){
        this.status = MessageStatus.CANCELLING;
        await this.update();
        return this;
    }

    async confirm():Promise<Message>{
        this.statusToDoing();
        return this;
    }



    async cancel():Promise<Message>{
        this.statusToCancelling();
        return this.update();
    }
}