
export enum MessageType{
    GENERAL = 'GENERAL',
    TRANSACTION = 'TRANSACTION'
}

export enum MessageStatus{
    PENDING =  'PENDING',

    DOING = 'DOING',
    DONE = 'DONE',

    CANCELLING = 'CANCELLING',
    CANCELED = 'CANCELED',
}

export enum ActorMessageStatus{
    PENDING = 'PENDING',
    DONE = 'DONE',
    CANCELED = 'CANCELED',
}