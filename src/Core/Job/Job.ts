import * as bull from 'bull';
import { JobAction } from '../../Constants/JobConstants';
export class Job{
    public id:number | string;
    public message_id:number | string;
    public action:JobAction
    constructor(public readonly context:bull.Job){
        this.id = this.context.id;
        this.message_id = this.context.data.message_id;
        this.action = this.context.data.action;
    }
    /**
     * 整理数据
     */
    public toJson(){
        let json:object = Object.assign({},this);
        delete json['context'];
        return json;
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

}