
import { NohmModel, TTypedDefinitions } from "nohm";
import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";

interface SubtaskProperties {
    parent_id: Number; //TODO 还原为message_id
    job_id: Number;
    type:SubtaskType;
    status: SubtaskStatus;
    data: any;
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
        parent_id: {
            type: 'integer',
            index:true,
            validations: ['notEmpty']
        },
        job_id: {
            type: 'integer',
            defaultValue:'-1',//nohm数字类型，不存在的时候为0，为了避免误解
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

