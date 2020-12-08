
import { NohmModel, TTypedDefinitions } from "yinohm";
import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";

interface SubtaskProperties {
    message_id: Number; //TODO 还原为message_id
    job_id: Number;
    type:SubtaskType;
    status: SubtaskStatus;
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

