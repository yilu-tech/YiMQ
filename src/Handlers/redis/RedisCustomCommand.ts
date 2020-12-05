import { MessageType } from "../../Constants/MessageConstants";


export function redisCustomCommand(client){

    // let has_value = `
    // local function has_value (tab, val)
    //     for index, value in ipairs(tab) do
    //         if value == val then
    //             return true
    //         end
    //     end
    //     return false
    // end
    // `

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
        -- 处理LstrSubtask
        ${subtaskCompleteScript}

        --- BroadcastMessage done后处理transaction message
        if(redis.call("HGET", message_hash_key, 'type') ~= '${MessageType.BROADCAST}')
        then
            return result;
        end

        -- 判断是否是 BcstSubtask创建的BroadcastMessage
        local bcst_subtask_id = nil
        local parent_subtask = redis.call('HGET', message_hash_key, 'parent_subtask');

        if(parent_subtask == '-1')
        then
            return result;
        end
        
        -- 获取 LstrSubtask 对应的 bcst_subtask_id
        bcst_subtask_id = string.match(parent_subtask, "@(.+)")
  
        local bcst_subtask_hash_key = prefix .. 'hash:subtask:' .. bcst_subtask_id;
        -- 获取 bcst_subtask 对应的message
        local transaction_message_id = redis.call("HGET", bcst_subtask_hash_key, 'message_id')

        -- 处理 BcstSubtask
        subtask_id = bcst_subtask_id;
        message_id = transaction_message_id;

        ${subtaskCompleteScript}
    
        return result
        
        `
    })

    client.defineCommand('message_has_subtask',{
        numberOfKeys:4,
        lua:`

        local message_has_subtask_ids_tmp_key = KEYS[1];

        local subtask_message_id_index_key = KEYS[2];
        local subtask_consumer_id_index_key = KEYS[3];
        local subtask_processor_index_key = KEYS[4];



        local result = redis.call('SINTERSTORE',message_has_subtask_ids_tmp_key, subtask_message_id_index_key, subtask_consumer_id_index_key,subtask_processor_index_key)
        redis.call('DEL',message_has_subtask_ids_tmp_key);
        return result;

        `
    })

    client.defineCommand('message_link_subtask_id',{
        numberOfKeys:1,
        lua:`
        local message_key = KEYS[1];
        local subtask_id = ARGV[1]
        local subtask_ids = redis.call('HGET',message_key,'subtask_ids');


        if(not subtask_ids or subtask_ids == '')
        then
            subtask_ids = {};
        else
            subtask_ids = cjson.decode(subtask_ids)
        end

        table.insert(subtask_ids,subtask_id)

        subtask_ids = cjson.encode(subtask_ids);

        redis.call('HSET',message_key,'subtask_ids',subtask_ids)
        return subtask_ids;
        `
    })

    client.defineCommand('getClearMessageIds',{
        numberOfKeys:4,
        lua:`
        local actor_key = 'nohm:index:message:actor_id:' .. KEYS[1];
        local message_status_key = 'nohm:index:message:status:' .. KEYS[2];
        local clear_status_key = 'nohm:index:message:clear_status:' .. KEYS[3];
        local limit = KEYS[4];

        local waiting_clear_message_tmp_key = 'actors:' .. KEYS[1] ..':waiting_clear_done_messages';

        local waiting_clear_done_messages = redis.call('SINTERSTORE',waiting_clear_message_tmp_key, actor_key, message_status_key, clear_status_key)


        local result =  redis.call('SRANDMEMBER',waiting_clear_message_tmp_key,limit)
        redis.call('DEL',waiting_clear_message_tmp_key);

        return result;
        `
    })

    client.defineCommand('getWaitingClearMessageTotal',{
        numberOfKeys:1,
        lua:`
        local actor_id = KEYS[1];
        local clear_status = ARGV[1];

        -- actor_id 索引
        local message_actor_index_key = 'nohm:index:message:actor_id:' .. actor_id;
        -- done status message索引
        local done_message_status_index_key = 'nohm:index:message:status:DONE';
        -- canceled message索引
        local canceled_message_status_index_key = 'nohm:index:message:status:CANCELED';

        -- clear status索引
        local clear_status_index_key = 'nohm:index:message:clear_status:' .. clear_status;

        local waiting_clear_done_messages_tmp_key = 'actors:' .. KEYS[1] ..':waiting_clear_done_messages_tmp';
        local waiting_clear_canceled_messages_tmp_key = 'actors:' .. KEYS[1] ..':waiting_clear_canceled_messages_tmp';

        -- actor_id   done clear_status 取交集
        redis.call('SINTERSTORE',waiting_clear_done_messages_tmp_key, message_actor_index_key, done_message_status_index_key, clear_status_index_key)
        local done_total = redis.call('SCARD',waiting_clear_done_messages_tmp_key);

        -- actor_id   canceled clear_status 取交集
        redis.call('SINTERSTORE',waiting_clear_canceled_messages_tmp_key, message_actor_index_key, canceled_message_status_index_key, clear_status_index_key)
        local canceld_total = redis.call('SCARD',waiting_clear_canceled_messages_tmp_key);


        local total = done_total + canceld_total;

        redis.call('DEL',waiting_clear_done_messages_tmp_key);
        redis.call('DEL',waiting_clear_canceled_messages_tmp_key);

        return total;
        `
    })
}