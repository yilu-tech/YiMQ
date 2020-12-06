import { Exclude, Expose, Transform } from 'class-transformer';
import { format } from 'date-fns';
import { ExposeGroups ,OnDemandSwitch} from '../../Constants/ToJsonConstants';
import { JobStatus, JobType } from '../../Constants/JobConstants';
import { OnDemand } from '../../Decorators/OnDemand';
import { Job as BullJob, JobsOptions} from 'bullmq';
export abstract class Job{
    @Expose()
    public id:number;

    @Expose()
    public type:JobType;

    @Expose()
    public status:JobStatus
    
    opts: JobsOptions;

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
    @Expose({groups:[ExposeGroups.JOB_FULL]})
    stacktrace: string[];

    @Expose({groups:[ExposeGroups.JOB_FULL]})
    returnvalue: any;

    @Expose({groups:[ExposeGroups.JOB_FULL]})
    @Transform((value) => {
        try {
            return JSON.parse(value);
        } catch (error) {
            return value
        }
    } )
    failedReason?: string|object;
    
    @Exclude()
    public readonly context:BullJob;
    
    constructor(context:BullJob){
        this.context = context;
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
    public async restore(){
    }

    // abstract async cancel();
    @OnDemand(OnDemandSwitch.JOB_STATUS)
    public async loadStatus(){
        this.status = await this.getStatus();
        return true;
    }
    abstract async process();

    // private async update(){
    //     await this.context.update(this.toJson());
    // }
    public async remove(){
        return await this.context.remove();
    }

    public async getStatus():Promise<JobStatus>{
        let status:any =  await this.context.getState();
        return status;
    }

    public async promote(){
        await this.context.promote();
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

}