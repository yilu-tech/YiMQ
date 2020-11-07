
export enum ExposeGroups{
    ACTOR_BASIC = 'ACTOR_BASIC',
    JOB_FULL = 'JOB_FULL',
    JOB_PARENT = 'JOB_PARENT',

    SUBTASK_PARENT = 'SUBTASK_PARENT'
}

export enum BeforeToJsonSwitch{
    JOB_STATUS = 'JOB_STATUS',

    MESSAGE_SUBTASKS_TOTAL = 'MESSAGE_SUBTASKS_TOTAL',
    MESSAGE_SUBTASKS = 'MESSAGE_SUBTASKS'
}

export class ToJsonOptions{
    switchs:BeforeToJsonSwitch[] = [];
    groups:ExposeGroups[] = [];
}