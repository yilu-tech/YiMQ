import { Message } from "./Message";


export class GeneralMessage extends Message{
    restore() {
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
    async confirm():Promise<Message>{
        return this;
    }
    cancel():Promise<Message> {
        throw new Error("Method not implemented.");
    }
    createMessageJob(){
        console.log('transaction message job create.');
        
    }
}