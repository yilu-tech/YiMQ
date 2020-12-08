
import { NohmModel, TTypedDefinitions } from "yinohm";



interface ListenerProperties {
    actor_id: number;
    /**
     * 监听的topic  user@user.update  
     * 
     * 1. 没有把actor名字'user'转为为actor的原因
     * 答: 解耦监听器，即使广播的发起方不存在也可以提前注册监听器
     * 
     * 2. 没有把user和user.update分开存字段是因为
     * 答: 减少索引
     */
    topic: string;
    processor: string;
    created_at: number;
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
            validations: ['notEmpty'],
        },
        created_at: {
            type: 'timestamp',
            index: true,
            validations: ['notEmpty']
        }
    };
}

