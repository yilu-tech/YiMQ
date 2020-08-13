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

    async onCompleted(job,result){
        console.log('ActorClearJob onCompleted')
    }

    private async update(){
        await this.context.update(this.toJson());
    }
    public async remove(){
        return await this.context.remove();
    }

    public async getStatus(){
        return await this.context.getState();
    }
    /**
     * 整理数据
     */
    public toJson(full=false){
        let json:object = Object.assign({},this);
        delete json['context'];
        delete json['message'];
        if(full){
            json['context'] = this.getContextJson();
        }

        return json;
    }
    

    public getContextJson(){
        let context = this.context.toJSON();
        try{
            context['failedReason'] = JSON.parse(context['failedReason'])
        }catch(e){
            context['failedReason'] = context['failedReason'];
        }
        return context;
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

}