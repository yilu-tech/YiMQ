import * as bull from 'bull';
import { classToPlain, Expose, Transform, Type } from 'class-transformer';
import { format } from 'date-fns';
import { JobStatus, JobType } from '../../Constants/JobConstants';
export abstract class Job{
    @Expose()
    public id:number;

    @Expose()
    public type:JobType;

    @Expose()
    public status:JobStatus
    
    @Expose()
    opts: bull.JobOptions;

    /**
     * How many attempts where made to run this job
     */
    @Expose()
    attemptsMade: number;

    /**
     * When this job was started (unix milliseconds)
     */
    @Expose()
    @Transform(value => {
        return value ? format(value,'yyyy-MM-dd HH:mm:ss') : null;
    })
    processed_at?: number;

    /**
     * When this job was completed (unix milliseconds)
     */
    @Expose()
    @Transform(value => {
        return value ? format(value,'yyyy-MM-dd HH:mm:ss') : null;
    })
    finished_at?: number;

    @Expose()
    @Transform(value => format(value,'yyyy-MM-dd HH:mm:ss'))
    created_at: number;
    /**
     * The stacktrace for any errors
     */
    @Expose({groups:['full']})
    stacktrace: string[];

    @Expose({groups:['full']})
    returnvalue: any;

    @Expose({groups:['full']})
    failedReason?: string;

    constructor(public readonly context:bull.Job){
        this.id = Number(this.context.id);
        this.type = this.context.data.type;
        this.opts = this.context.opts;
        this.attemptsMade = this.context.attemptsMade;
        this.processed_at = this.context.processedOn;
        this.finished_at = this.context.finishedOn;
        this.created_at = this.context.timestamp;
        this.stacktrace = this.context.stacktrace;
        this.returnvalue = this.context.returnvalue;
        this.failedReason = this.context.failedReason;

    }
    public async restore(full=false){
        if(full){
            this.status = await this.getStatus();
        }
    }

    // abstract async cancel();

    abstract async process();

    private async update(){
        await this.context.update(this.toJson());
    }
    public async remove(){
        return await this.context.remove();
    }

    public async getStatus():Promise<JobStatus>{
        let status:any =  await this.context.getState();
        return status;
    }
    /**
     * 整理数据
     */
    public toJson(full=false){
        if(full){
            return classToPlain(this,{strategy:'excludeAll',groups:['full']})
        }
        return classToPlain(this,{strategy:'excludeAll'})
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

}