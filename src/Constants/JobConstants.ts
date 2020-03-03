
export enum JobType{
    GENERAL = 'GENERAL',
    TRANSACTION = 'TRANSACTION',
    TRANSACTION_ITEM = 'TRANSACTION_ITEM'
}


export enum JobAction{ //TODO 因为job已经区分类型了，是否不再需要
    CHECK = 'CHECK',
    CONFIRM = 'CONFIRM',
    ROLLBACK = 'ROLLBACK'
}

export enum JobStatus{
    DELAYED =  'delayed',
    FAILED = 'failed',
    COMPLETED = 'completed',
    STUCK = 'stuck'
}


