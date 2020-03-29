
import { NohmModel, TTypedDefinitions } from "nohm";



interface ListenerProperties {
    actor_id: number;
    topic: string;
    processor: string;
}

export class ListenerModelClass extends NohmModel<ListenerProperties> {
    public static modelName = 'listeners';
    public static idGenerator = 'increment';

    protected static definitions: TTypedDefinitions<ListenerProperties> = {
        actor_id: {
            type: 'integer',
            index: true,
            validations: ['notEmpty'],
        },
        topic: {
            type: 'string',
            index: true,
            validations: ['notEmpty'],
        },
        processor: {
            type: 'string',
            index: true,
            unique: true,
            validations: ['notEmpty'],
        }
    };
}

