
export enum JobType{
    MESSAGE = 'MESSAGE',
    SUBTASK = 'SUBTASK',
    ACTOR_CLEAR = 'ACTOR_CLEAR',
    TEST = 'TEST'
}

export enum JobStatus{
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    WAITING = 'WAITING',
    ACTIVE = 'ACTIVE',
    DELAYED =  'DELAYED',
    FAILED = 'FAILED',
    PAUSED = 'PAUSED',

    // STUCK = 'stuck'
}

export enum JobEventType{
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED'
}


