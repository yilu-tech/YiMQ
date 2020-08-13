
import { NohmModel, TTypedDefinitions } from "nohm";
import { MessageStatus } from "../Constants/MessageConstants";

interface MessageProperties {
    id:number,
    actor_id:number,
    topic: string;
    type:string;
    context:string;
    data:string;
    pending_subtask_total: number;
    status: MessageStatus;
    job_id: number;
    subtask_contexts:object;//TODO change name to subtasks
    clear_status:string;
    updated_at: number;
    created_at: number;

}

export class MessageModelClass extends NohmModel<MessageProperties> {
    public static modelName = 'message';
    // public static idGenerator = 'increment';
    protected static definitions: TTypedDefinitions<MessageProperties> = {
        id:{
            type:'integer',
            index:true,
            validations: ['notEmpty']
        },
        actor_id:{
            type:'integer',
            index:true,
            validations: ['notEmpty']
        },
        topic: {
            type: 'string',
            index:true,
            validations: ['notEmpty']
        },
        type: {
            type: 'string',
            index:true,
            validations: ['notEmpty']
        },
        context: {
            type: 'json',
        },
        data: {
            type: 'json',
        },
        pending_subtask_total: {
            type: 'integer',
        },
        status: {
            type: 'string',
            index: true,
            validations: ['notEmpty']
        },
        job_id: {
            type: 'integer',
            index: true
        },
        subtask_contexts:{
            type: 'json',
            defaultValue:[]
        },
        clear_status: {
            type: 'string',
            index: true,
            validations: ['notEmpty']
        },
        updated_at: {
            type: 'timestamp',
            index: true,
            validations: ['notEmpty']
        },
        created_at: {
            type: 'timestamp',
            index: true,
            validations: ['notEmpty']
        }
    };
}

