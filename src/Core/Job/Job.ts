import * as bull from 'bull';
import { JobAction, JobType } from '../../Constants/JobConstants';
import { Message } from '../Messages/Message';
export class Job{
    public id:number | string;
    public message_id:number | string;
    public action:JobAction;
    public type:JobType;
    public message:Message;
    constructor(message:Message,public readonly context:bull.Job){
        this.id = this.context.id;
        this.type = this.context.data.type;
        this.message_id = this.context.data.message_id;
        this.action = this.context.data.action;
        this.message = message;
    }

    public async cancel(){
        await this.message.cancel();
    }

    public async done(){
        await this.message.done();
    }

    public async remove(){
        return this.context.remove();
    }
    private async update(){
        await this.context.update(this.toJson());
    }
    /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['context'];
        delete json['message'];
        return json;
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

}