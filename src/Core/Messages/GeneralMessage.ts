import { Message } from "./Message";


export class GeneralMessage extends Message{
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