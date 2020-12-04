
export enum JobType{
    MESSAGE = 'MESSAGE',
    SUBTASK = 'SUBTASK',
    ACTOR_CLEAR = 'ACTOR_CLEAR'
}

export enum JobStatus{
    COMPLETED = 'completed',
    WAITING = 'waiting',
    ACTIVE = 'active',
    DELAYED =  'delayed',
    FAILED = 'failed',
    PAUSED = 'paused',

    // STUCK = 'stuck'
}


