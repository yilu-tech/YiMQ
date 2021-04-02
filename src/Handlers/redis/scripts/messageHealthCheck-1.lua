local message_hash_key = KEYS[1];


local message_status = redis.call("HGET", message_hash_key, 'status')
local job_id = redis.call("HGET", message_hash_key, 'job_id')
local actor_id = redis.call("HGET", message_hash_key, 'actor_id')
local message_job_hash_key = 'bull:' .. actor_id .. ':' .. job_id;





-- PENDING PREPARED 检查message的job次数，其他状态检查subtask is_health
if(message_status == 'PENDING' or message_status == 'PREPARED' ) 
then
    local job_attemptsMade = redis.call('HGET',message_job_hash_key,'attemptsMade');

    if(job_attemptsMade and tonumber(job_attemptsMade) >=2)
    then
        redis.call('HSET',message_hash_key,'is_health','false');
        return false;
    else
        redis.call('HSET',message_hash_key,'is_health','true');
        return true;
    end
else
    local subtask_ids_string = redis.call('HGET',message_hash_key,'subtask_ids');
    -- subtask_ids_string 不存在，说明没有subtask，设置message is_health=true
    if(not subtask_ids_string)
    then
        return redis.call('HSET',message_hash_key,'is_health','true');
    end

    local subtask_ids = cjson.decode(subtask_ids_string);

    local is_health = true;
    local is_health_string = 'true';

    for i, v in pairs(subtask_ids) do 
        local subtask_hash_key = 'nohm:hash:subtask:'..v;
        local subtask_is_health = redis.call('HGET',subtask_hash_key,'is_health');
        is_health = is_health and subtask_is_health == 'true';
    end 

    -- 只要有一个subtask is_health为fasle，message的is_health就为fasle
    if(is_health == false)
    then
        is_health_string = 'false'
    end
    redis.call('HSET',message_hash_key,'is_health',is_health_string);
    
    return is_health;
end
