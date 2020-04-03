import { Message, MessageControlResult } from "./Message";


export class GeneralMessage extends Message{
    toDoing(): Promise<Message> {
        throw new Error("Method not implemented.");
    }
    statusToDoing(): Promise<Message> {
        throw new Error("Method not implemented.");
    }
    statusToCancelling(): Promise<Message> {
        throw new Error("Method not implemented.");
    }
    done():Promise<Message> {
        throw new Error("Method not implemented.");
    }
    async confirm():Promise<MessageControlResult>{
        let result:MessageControlResult=<MessageControlResult>{};
        return result;
    }
    async cancel():Promise<MessageControlResult> {
        let result:MessageControlResult=<MessageControlResult>{};
        return result;
    }
    createMessageJob(){
        console.log('transaction message job create.');
        
    }
}