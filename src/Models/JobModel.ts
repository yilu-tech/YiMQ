
import {  Document, Schema, Types } from "mongoose";
import { JobStatus, JobType } from "../Constants/JobConstants";
import { JobOptions } from "../Interfaces/JobOptions";



export interface JobModel extends Document{
    type:JobType;
    actor_id:number;
    relation_id:Types.ObjectId;
    status:JobStatus;
    options: JobOptions;
    delay: number;
    // attempts:number;
    attempts_made: number;
    created_at: Date;
    available_at:Date;
    reserved_at?: Date;
    finished_at?: Date;
    stacktrace: string[];
    returnvalue: any;
    failedReason?: string|object;
}

export const JobOptionsSchema:Schema = new Schema({
    attempts:{type:Schema.Types.Number},
    timeout:{type:Schema.Types.Number},
    delay:{type:Schema.Types.Number,required:true},
},{_id:false});

export const JobSchema:Schema = new Schema({
    type:{type:Schema.Types.String,required:true},
    actor_id: {type: Schema.Types.String,required:true},
    relation_id:{type:Schema.Types.ObjectId,required:false},
    status:{type:Schema.Types.String,required:true},
    options: {type: JobOptionsSchema,required:true},
    delay:{type:Schema.Types.Number,required:true},
    // attempts:{type:Schema.Types.Number,required:true},
    attempts_made:{type:Schema.Types.Number,required:true},
    created_at:{type:Schema.Types.Date,required:true},
    available_at:{type:Schema.Types.Date,required:true},
    reserved_at: {type:Schema.Types.Date,required:false},
    finished_at:{type:Schema.Types.Date,required:false},
    stacktrace: {type:Schema.Types.String,required:false},
    returnvalue: {type:Schema.Types.String,required:false},
    failedReason: {type:Schema.Types.String,required:false},
},{

})

