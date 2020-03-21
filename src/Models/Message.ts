
import { NohmModel, TTypedDefinitions } from "nohm";
import { MessageStatus } from "../Constants/MessageConstants";

interface MessageProperties {
    id:number,
    actor_id:number,
    topic: string;
    type:string;
    pending_subtask_total: number;
    status: MessageStatus;
    job_id: number;
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

