import { RedisManager } from "./redis/RedisManager";
import { Nohm } from "./Nohm";


export const handlerInjects = [
    RedisManager,
    Nohm
];