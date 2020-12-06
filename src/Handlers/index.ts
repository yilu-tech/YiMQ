import { format } from "date-fns";
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