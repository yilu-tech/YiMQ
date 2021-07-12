
import { Document, ObjectId, Schema, Types } from "mongoose";
import { NohmModel, TTypedDefinitions } from "yinohm";
import { SubtaskType, SubtaskStatus, SubtaskOptions } from "../Constants/SubtaskConstants";
// import { TccSubtaskPrepareResult } from "../Core/Subtask/TccSubtask";
import { JobOptions } from "../Interfaces/JobOptions";

interface SubtaskProperties {
    message_id: Number; //TODO 还原为message_id
    job_id: Number;
    type:SubtaskType;
    status: SubtaskStatus;
    is_health:boolean;
    data: any;
    options:any;
    producer_id:number;
    consumer_id:number;
    processor:string;
    context:string;
    prepareResult:string;
    updated_at: number;
    created_at: number;

}

export class SubtaskModelClass extends NohmModel<SubtaskProperties> {
    public static modelName = 'subtask';
    // public static idGenerator = 'increment';
    protected static definitions: TTypedDefinitions<SubtaskProperties> = {
        message_id: {
            type: 'integer',
            index:true,
            validations: ['notEmpty']
        },
        job_id: {
            type: 'integer',
            // defaultValue:-1,//nohm默认值不会自动删除索引，不能使用
            index:true
        },
        type: {
            type: 'string',
            index:true,
            validations: ['notEmpty']
        },
        status: {
            type: 'string',
            index: true,
            validations: ['notEmpty']
        },
        is_health:{
            type: 'boolean',
            index: true
        },
        data: {
            type: 'json',
        },
        options: {
            type: 'json',
        },
        producer_id:{
            type:'integer',
            index:true,
            validations: ['notEmpty']
        },
        consumer_id:{
            type:'integer',
            index:true
        },
        processor: {
            type: 'string',
            index: true,
        },
        prepareResult: {
            type: 'json',
        },
        context: {
            type: 'json',
        },
        updated_at: {
            type: 'timestamp',
            validations: ['notEmpty']
        },
        created_at: {
            type: 'timestamp',
            validations: ['notEmpty']
        }
    };
}

export interface SubtaskPrepareResultModel extends Document{
    status: number;
    message:string;
    data:string|object;
}

export const SubtaskPrepareResultSchema:Schema = new Schema({
    status: {type: Schema.Types.Number,required:false},
    message: {type: Schema.Types.String,required:false},
    data: {type: Schema.Types.Mixed,required:false},
},{
    _id:false
})

export interface SubtaskModel extends Document{
    message_id: Types.ObjectId; //TODO 还原为message_id
    job_id: Types.ObjectId;
    type:SubtaskType;
    status: SubtaskStatus;
    is_health:boolean;
    data: any;
    options:JobOptions;
    producer_id:number;
    consumer_id:number;
    processor:string;
    context:string;
    prepareResult:SubtaskPrepareResultModel;
    updated_at: number;
    created_at: number;
}



export const SubtaskSchema:Schema = new Schema({
    message_id:{type: Schema.Types.ObjectId,required:true},
    job_id: {type: Schema.Types.ObjectId,required:true},
    type:{type:'string',required:true},
    status:{type:'string',required:true},
    // is_health:{type:'string',required:true},
    // options:{type: subtaskOptionsSchema,required:true},
    producer_id: {type: Schema.Types.String,required:true},
    consumer_id: {type: Schema.Types.String,required:true},
    processor:{type:Schema.Types.String,required:true},
    context: {type:Schema.Types.String,required:false},
    prepareResult:SubtaskPrepareResultSchema,
    // updated_at:{type:Schema.Types.String,required:true},
    // created_at: {type:Schema.Types.Date,required:true},
},{
    timestamps: {createdAt:'created_at',updatedAt:false}
})