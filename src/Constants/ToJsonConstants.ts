
export enum ExposeGroups{

    //Common
    RELATION_ACTOR = 'RELATION_ACTOR',//关联actor producer counsumer

    

    //Actor
    // ACTOR_BASIC = 'ACTOR_BASIC',

    //Message
    MESSAGE_JOB = 'MESSAGE_JOB',

    //Job
    JOB_FULL = 'JOB_FULL',
    JOB_PARENT = 'JOB_PARENT',
    SUBTASK_JOB = 'SUBTASK_JOB',

    //Subtask
    SUBTASK_MESSAGE = 'SUBTASK_MESSAGE'
}

export enum OnDemandSwitch{
    JOB_STATUS = 'JOB_STATUS',
    
    MESSAGE_JOB = 'MESSAGE_JOB',
    MESSAGE_SUBTASKS_TOTAL = 'MESSAGE_SUBTASKS_TOTAL',
    MESSAGE_SUBTASKS = 'MESSAGE_SUBTASKS',

    SUBTASK_JOB = 'SUBTASK_JOB'
}