import * as bull from 'bull';
import { Exclude, Expose, Transform } from 'class-transformer';
import { addMilliseconds, format } from 'date-fns';
import { ExposeGroups ,OnDemandSwitch} from '../../Constants/ToJsonConstants';
import { JobStatus, JobType } from '../../Constants/JobConstants';
import { OnDemand } from '../../Decorators/OnDemand';
import { JobModel } from '../../Models/JobModel';
import { Subtask } from '../Subtask/BaseSubtask/Subtask';
import { Message } from '../Messages/Message';
import { Application } from '../../Application';
import { Database } from '../../Database';
import { BusinessException } from '../../Exceptions/BusinessException';
import { ClientSession, Types } from 'mongoose';
import { JobCreateTransactionCallback, TransactionCallback } from '../../Handlers';
import { JobOptions } from '../../Interfaces/JobOptions';
import { merge, mergeWith } from 'lodash';
import { Actor } from '../Actor';
import { CoordinatorProcessResult } from '../Coordinator/Coordinator';


export abstract class Job{

    application:Application
    actor_id:number;

    @Expose({groups:[ExposeGroups.RELATION_ACTOR]})
    public actor:Actor;

    database:Database
    @Expose()
    public id:Types.ObjectId;

    @Expose()
    public relation_id:Types.ObjectId;

    @Expose()
    public type:JobType;

    @Expose()
    public status:JobStatus
    @Expose()
    options:JobOptions
    /**
     * next delay
     */
    delay:number;
    // attempts:number;

    /**
     * How many attempts where made to run this job
     */
    @Expose()
    attempts_made: number;

    @Expose()
    @Transform(value => format(value,'yyyy-MM-dd HH:mm:ss'))
    created_at: Date;

    /**
     * When this job was started (unix milliseconds)
     * */
    @Expose()
    @Transform(value => {
        return value ? format(value,'yyyy-MM-dd HH:mm:ss') : null;
    })
    available_at?: Date;

    /**
     * When this job was started (unix milliseconds)
     */
    @Expose()
    @Transform(value => {
        return value ? format(value,'yyyy-MM-dd HH:mm:ss') : null;
    })
    reserved_at?: Date;

    /**
     * When this job was completed (unix milliseconds)
     */
    @Expose()
    @Transform(value => {
        return value ? format(value,'yyyy-MM-dd HH:mm:ss') : null;
    })
    finished_at?: Date;

 
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
    public readonly context:bull.Job;

    public model:JobModel
    
    constructor(producer:Actor){
        this.actor = producer;
        this.application = producer.actorManager.application;
        this.database = this.application.database;
        this.model = new this.database.JobModel();

    }

    public async create(jobOptions:JobOptions,session:ClientSession){
        this.model.type = this.type;
        this.model.actor_id = this.actor.id;
        this.model.relation_id = this.relation_id;

        
        

        //job default options
        this.model.options = <JobOptions>{
            delay:  0,
            attempts: 3,
        };


        this.model.options = mergeWith(this.model.options,jobOptions,(objValue,srcValue)=>{
            return srcValue ? srcValue : objValue;
        })
        this.model.delay = this.model.options.delay;

        this.model.attempts_made = 0;

        this.model.created_at = new Date();
        this.model.available_at =  addMilliseconds(this.model.created_at,this.model.options.delay);


        this.model = await this.model.save({session});
        await this.initProperties()
        return this;
    }
    public async restore(jobModel:JobModel){
        this.model = jobModel;
        await this.initProperties()
    }

    public async initProperties(){
        this.id = this.model._id;
        this.type = this.model.type;
        this.actor_id = this.model.actor_id;
        this.options = this.model.options;
        this.delay = this.model.delay;
        // this.attempts = this.attempts;
        this.attempts_made = this.model.attempts_made;

        this.created_at = this.model.created_at;
        this.available_at = this.model.available_at;
        this.reserved_at = this.model.reserved_at;
        this.finished_at = this.model.finished_at;
        
        this.status = <JobStatus>this.model.status;
        this.stacktrace = this.model.stacktrace;
        this.returnvalue = this.model.returnvalue;
        this.failedReason = this.model.failedReason;
    }

    // abstract async cancel();
    @OnDemand(OnDemandSwitch.JOB_STATUS)
    public async loadStatus(){
        this.status = await this.getStatus();
        return true;
    }
    abstract  process():Promise<CoordinatorProcessResult>;

    // private async update(){
    //     await this.context.update(this.toJson());
    // }
    public async remove(){
        return await this.context.remove();
    }

    public async getStatus():Promise<JobStatus>{
        let jobModel =  await this.database.JobModel.findById(this.id).select('status');
        return jobModel.status;
    }
    
    async setStatus(originStatus:JobStatus,targetStatus:JobStatus,session:ClientSession){
        let updatedJobModel = await this.database.JobModel
        .findOneAndUpdate({_id: this.id,status: originStatus},{
            $set:{
                status: targetStatus
            }
        },{session,new:true});

        if(!updatedJobModel){
            let updatedStatus = await this.getStatus();
            throw new BusinessException(`The job is in the ${updatedStatus} state and cannot be changed to ${targetStatus}`)
        };
        this.model = updatedJobModel;
        await this.initProperties();
    }

    async setStatusWithTransacation(originStatus:JobStatus,targetStatus:JobStatus,callback:TransactionCallback=null){
        let session = await this.database.connection.startSession();

        await session.withTransaction(async()=>{
            await this.setStatus(originStatus,targetStatus,session);
            callback && await callback(session)
        })
        await session.endSession();
    }

    public async prepareWithTransaction(callback:TransactionCallback=null){

        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            await this.prepare(session);
            callback && await callback(session);
        })

    }

    public async prepare(session:ClientSession){

        let updatedResult = await this.database.JobModel.findOneAndUpdate({
            _id:this.id,
            status:JobStatus.PENDING
        },{
            $set:{
                status: JobStatus.DELAYED
            }
        },{session,new:true});
        
        if(!updatedResult){
            let jobModel = await this.database.JobModel.findById(this.id).select('status');
            throw new BusinessException(`The job cannot be promote in the ${jobModel.status} state.`)
        };

        if(!updatedResult){
            let exists = await this.database.JobModel.exists({_id: this.id});
            if(!exists){
                throw new BusinessException('JOB_PREPARE_NOT_FOUND')
            }
            let currentStatus = await this.getStatus();
            throw new BusinessException('JOB_PREPARE_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus:JobStatus.PENDING})
        }
        this.model = updatedResult;
        await this.initProperties();
    }

    public async promoteWithTransaction(callback:TransactionCallback=null){
        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            let updatedResult = await this.database.JobModel.findOneAndUpdate({
                _id:this.id,
                $or:[
                    {status:JobStatus.PENDING},
                    {status:JobStatus.DELAYED},
                ]
            },{
                $set:{
                    status: JobStatus.WAITING,
                    delay: 0, //延迟变为0
                    available_at: new Date()
                }
            },{session,new:true});
            
            if(!updatedResult){
                let exists = await this.database.JobModel.exists({_id: this.id});
                if(!exists){
                    throw new BusinessException('JOB_PROMOTE_NOT_FOUND')
                }
                let currentStatus = await this.getStatus();
                throw new BusinessException('JOB_PROMOTE_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus:JobStatus.PENDING})
            }
            
            this.model = updatedResult;
            await this.initProperties()

            callback && await callback(session);
        })
    }

    // public async retry():Promise<void>{
    //     await this.context.retry();

    // }

    public async moveToCompleted(){

        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            let updatedResult = await this.database.JobModel.findOneAndUpdate({
                _id:this.id,
                status:JobStatus.ACTIVE
            },{
                $set:{
                    status: JobStatus.COMPLETED,
                    finished_at: new Date()
                }
            },{session,new:true});
            
            if(!updatedResult){
                let exists = await this.database.JobModel.exists({_id: this.id});
                if(!exists){
                    throw new BusinessException('JOB_MOVE_TO_COMPLETED_NOT_FOUND')
                }
                let currentStatus = await this.getStatus();
                throw new BusinessException('JOB_MOVE_TO_COMPLETED_ORIGIN_STATUS_MISTAKE',{currentStatus,originStatus:JobStatus.PENDING})
            }
            
            this.model = updatedResult;
            await this.initProperties()
        })
    }

    public async moveToFailed(){

        let session = await this.database.connection.startSession();
        await session.withTransaction(async()=>{
            let updatedResult = await this.database.JobModel.findOneAndUpdate({
                _id:this.id,
                status:JobStatus.ACTIVE
            },{
                $set:{
                    status: JobStatus.FAILED,
                    finished_at: new Date()
                }
            },{session,new:true});
            
            await this.findAndUpdateResultHandler('JOB_MOVE_TO_FAILED',updatedResult,JobStatus.ACTIVE);
            
            this.model = updatedResult;
            await this.initProperties()
        })
    }

    private async findAndUpdateResultHandler(name,updatedResult:JobModel,originStatus:JobStatus){
        if(!updatedResult){
            let exists = await this.database.JobModel.exists({_id: this.id});
            if(!exists){
                throw new BusinessException(`${name}_NOT_FOUND`)
            }
            let currentStatus = await this.getStatus();
            throw new BusinessException(`${name}_ORIGIN_STATUS_MISTAKE`,{currentStatus,originStatus:originStatus})
        }
    }

}