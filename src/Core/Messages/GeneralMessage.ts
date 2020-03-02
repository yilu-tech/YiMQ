import { Message } from "./Message";


export class GeneralMessage extends Message{
    done() {
        throw new Error("Method not implemented.");
    }
    cancel() {
        throw new Error("Method not implemented.");
    }
    createMessageJob(){
        console.log('transaction message job create.');
        
    }
}