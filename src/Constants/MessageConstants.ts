
export enum MessageType{
    GENERAL = 'GENERAL',
    BROADCAST = 'BROADCAST',
    TRANSACTION = 'TRANSACTION'
}

export enum MessageStatus{
    PENDING =  'PENDING',
    PREPARED = 'PREPARED',
    DOING = 'DOING',
    DONE = 'DONE',

    CANCELLING = 'CANCELLING',
    CANCELED = 'CANCELED',
}

export enum MessageClearStatus{
    WAITING = 'WAITING',
    FAILED = 'FAILED'
}

export enum ActorMessageStatus{
    PENDING = 'PENDING',
    PREPARED = 'PREPARED',
    DONE = 'DONE',
    CANCELED = 'CANCELED',
}