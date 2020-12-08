
export enum SubtaskType{
    EC = 'EC',
    TCC = 'TCC',
    XA = "XA",
    BCST = "BCST",
    LSTR = "LSTR"
}


export enum SubtaskStatus{
    PREPARING =  'PREPARING',
    PREPARED = 'PREPARED',
    
    DOING = 'DOING',
    DONE = 'DONE',

    CANCELLING = 'CANCELLING',
    CANCELED = 'CANCELED',
}

export interface SubtaskOptions{
    attempts?:number;
    timeout?:number;
    delay?:number;
}