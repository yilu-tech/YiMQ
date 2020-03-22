

export function redisCustomCommand(client){

    client.defineCommand('subtaskCompleteAndSetMessageStatus',{
        numberOfKeys:2,
        lua:`
        redis.call("HSET", KEYS[1],'status',ARGV[1])
        local subtaskStatus = redis.call("HGET", KEYS[1], 'status')

        local beforeStatus = redis.call("HGET", KEYS[2], 'status')
        local pending_subtask_total = redis.call("HINCRBY", KEYS[2], 'pending_subtask_total',-1)
        local status = beforeStatus;
        if(pending_subtask_total == 0)
        then
            redis.call("HSET", KEYS[2],'status',ARGV[2])
            status = redis.call("HGET", KEYS[2], 'status')
        end
        
        return {subtaskStatus,beforeStatus,pending_subtask_total,status}`
    })
}