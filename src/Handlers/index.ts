import { format } from "date-fns";
import { ClientSession } from "mongoose";
import { Job } from "../Core/Job/Job";
import { JobModel } from "../Models/JobModel";
import { RedisManager } from "./redis/RedisManager";



export const handlerInjects = [
    RedisManager,
];


export const timeout = (ms:number) => {
    return new Promise(res => setTimeout(res, ms))
} 


export const timestampToDateString = function(timestamp:number){
    return format(timestamp,'yyyy-MM-dd HH:mm:ss');
}

export type TransactionCallback = (session:ClientSession) => Promise<void>
export type JobCreateTransactionCallback = (session:ClientSession,job:JobModel) => Promise<void>