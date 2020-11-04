import * as bull from 'bull';
import { JobType } from '../../Constants/JobConstants';
export abstract class Job{
    public id:number;
    public type:JobType;
    

    opts: bull.JobOptions;

    /**
     * How many attempts where made to run this job
     */
    attemptsMade: number;

    /**
     * When this job was started (unix milliseconds)
     */
    processedOn?: number;

    /**
     * When this job was completed (unix milliseconds)
     */
    finishedOn?: number;
    timestamp: number;
    /**
     * The stacktrace for any errors
     */
    stacktrace: string[];

    returnvalue: any;

    failedReason?: string;

    constructor(public readonly context:bull.Job){
        this.id = Number(this.context.id);
        this.type = this.context.data.type;
        this.opts = this.context.opts;
        this.attemptsMade = this.context.attemptsMade;
        this.processedOn = this.context.processedOn;
        this.finishedOn = this.context.finishedOn;
        this.timestamp = this.context.timestamp;
        this.stacktrace = this.context.stacktrace;
        this.returnvalue = this.context.returnvalue;
        this.failedReason = this.context.failedReason;

    }

    // abstract async cancel();

    abstract async process();

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