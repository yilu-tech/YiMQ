import { MessageType } from "../../Constants/MessageConstants";


export function redisCustomCommand(client){

    let subtaskCompleteScript = `
   

    local prefix = 'nohm:';
    local message_hash_key = prefix .. 'hash:message:' .. message_id;
    local subtask_hash_key = prefix .. 'hash:subtask:' .. subtask_id;

    --处理subtask状态
    local subtask_current_status = redis.call("HGET", subtask_hash_key, 'status')

    redis.call("HSET", subtask_hash_key,'status',subtask_status)
    redis.call("HSET", subtask_hash_key,'updated_at',updated_at)
    local subtask_updated_status = redis.call("HGET", subtask_hash_key, 'status')
    -- 处理subtask status索引
    redis.call("SREM", prefix .. 'index:subtask:status:' .. subtask_current_status,subtask_id)
    redis.call("SADD", prefix .. 'index:subtask:status:' .. subtask_updated_status,subtask_id)


    
    --处理剩余任务数量
    local pending_subtask_total = redis.call("HINCRBY", message_hash_key, 'pending_subtask_total',-1)


    local message_current_status = redis.call("HGET", message_hash_key, 'status')
    local message_updated_status = message_current_status;

    local result = {
        subtask_updated_status,
        message_current_status,
        pending_subtask_total,
        message_updated_status,
    }

    --任务全部完成，设置message status为done
    if(pending_subtask_total > 0)
    then
        return result;
    end

    redis.call("HSET", message_hash_key,'status',message_status)
    message_updated_status = redis.call("HGET", message_hash_key, 'status')
    -- 处理message status索引
    redis.call("SREM", prefix .. 'index:message:status:' .. message_current_status,message_id)
    redis.call("SADD", prefix .. 'index:message:status:' .. message_updated_status,message_id)

    --处理updated_at
    local message_current_updated_at = redis.call("HGET", message_hash_key, 'updated_at')
    redis.call("HSET", message_hash_key,'updated_at',updated_at)
    redis.call("SREM", prefix .. 'index:message:updated_at:' .. message_current_updated_at,message_id)
    redis.call("SADD", prefix .. 'index:message:updated_at:' .. updated_at,message_id)


    `
    client.defineCommand('subtaskCompleteAndSetMessageStatus',{
        numberOfKeys:3,
        lua:`
            local subtask_id = KEYS[1];
            local subtask_status = ARGV[1];
            local message_id = KEYS[2];
            local message_status = ARGV[2];
            local updated_at = ARGV[3];
            ${subtaskCompleteScript}
            return result;
        `
    })

    /**
     * LstrSubtask专用，含有处理由BcstSubtask创建的广播消息，广播之后完成任务状态的逻辑
     */
    client.defineCommand('LstrSubtaskCompleteAndSetMessageStatus',{
        numberOfKeys:3,
        lua:`
        local subtask_id = KEYS[1];
        local subtask_status = ARGV[1];
        local message_id = KEYS[2];
        local message_status = ARGV[2];
        local updated_at = ARGV[3];
    
        ${subtaskCompleteScript}

        --- BroadcastMessage done后处理transaction message
        if(redis.call("HGET", message_hash_key, 'type') ~= '${MessageType.BROADCAST}')
        then
            return result;
        end

        local bcst_subtask_id = nil
        local context = redis.call('HGET', message_hash_key, 'context');
        if(context == false)
        then
            return result;
        end
        
        bcst_subtask_id = cjson.decode(context)['bcst_subtask_id'];
        if(bcst_subtask_id == false)
        then
            return result;
        end
        local bcst_subtask_hash_key = prefix .. 'hash:subtask:' .. bcst_subtask_id;
        local transaction_message_id = redis.call("HGET", bcst_subtask_hash_key, 'message_id')

        subtask_id = bcst_subtask_id;
        message_id = transaction_message_id;

        ${subtaskCompleteScript}
    
        return result
        
        `
    })
}