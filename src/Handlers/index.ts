import { RedisManager } from "./redis/RedisManager";



export const handlerInjects = [
    RedisManager,
];


export const timeout = ms => new Promise(res => setTimeout(res, ms))