
import { NohmModel, TTypedDefinitions } from "nohm";
import { SubtaskType, SubtaskStatus } from "../Constants/SubtaskConstants";

interface SubtaskProperties {
    message_id: Number;
    job_id: Number;
    type:SubtaskType;
    status: SubtaskStatus;
    data: any;
    processer:string;
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
        processer: {
            type: 'string',
        },
        prepareResult: {
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

