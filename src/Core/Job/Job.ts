import * as bull from 'bull';
import { JobType } from '../../Constants/JobConstants';
export abstract class Job{
    public id:number;
    public type:JobType;

    constructor(public readonly context:bull.Job){
        this.id = Number(this.context.id);
        this.type = this.context.data.type;
    }

    // abstract async cancel();

    abstract async process();

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