

export function redisCustomCommand(client){


    client.defineCommand('subtaskCompleteAndSetMessageStatus',{
        numberOfKeys:2,
        lua:`
    
        local subtask_id = KEYS[1];
        local subtask_status = ARGV[1];
        local message_id = KEYS[2];
        local message_status = ARGV[2];

        local prefix = 'nohm:';
        local message_hash_key = prefix .. 'hash:message:' .. message_id;
        local subtask_hash_key = prefix .. 'hash:subtask:' .. subtask_id;

        --处理subtask状态
        local subtask_current_status = redis.call("HGET", subtask_hash_key, 'status')

        redis.call("HSET", subtask_hash_key,'status',subtask_status)
        local subtask_updated_status = redis.call("HGET", subtask_hash_key, 'status')
        -- 处理subtask status索引
        redis.call("SREM", prefix .. 'index:subtask:status:' .. subtask_current_status,subtask_id)
        redis.call("SADD", prefix .. 'index:subtask:status:' .. subtask_updated_status,subtask_id)


        
        --处理剩余任务数量
        local pending_subtask_total = redis.call("HINCRBY", message_hash_key, 'pending_subtask_total',-1)


        local message_current_status = redis.call("HGET", message_hash_key, 'status')
        local message_updated_status = message_current_status;

        --任务全部完成，设置message status为done
        if(pending_subtask_total == 0)
        then
            redis.call("HSET", message_hash_key,'status',message_status)
            message_updated_status = redis.call("HGET", message_hash_key, 'status')
            -- 处理message status索引
            redis.call("SREM", prefix .. 'index:message:status:' .. message_current_status,message_id)
            redis.call("SADD", prefix .. 'index:message:status:' .. message_updated_status,message_id)
        end
        
        return {
            subtask_updated_status,
            message_current_status,
            pending_subtask_total,
            message_updated_status
        }`
    })
}