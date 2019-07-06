import { RedisManager } from "./redis/RedisManager";

import { RedisDao } from "./redis/ReidsDao";
import { ModelFactory } from "./ModelFactory";


export const handlerInjects = [
    RedisManager,
    RedisDao,
    ModelFactory,
];