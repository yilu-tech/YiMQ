import * as Ioredis from 'ioredis'

export class RedisClient extends Ioredis{

    async getInfo(){
        let info = await this.info();


        let server = {
            redis_version: info.match(/redis_version:(.*)/)[1],
            uptime_in_seconds: info.match(/uptime_in_seconds:(.*)/)[1],
            uptime_in_days: info.match(/uptime_in_days:(.*)/)[1],
        }
        let maxmemoryMatch = info.match(/maxmemory:(.*)/)
        let total_system_memory;
        let total_system_memory_human;
        
        if(maxmemoryMatch && Number(maxmemoryMatch[1]) != 0 ){
            total_system_memory = maxmemoryMatch[1]
            total_system_memory_human = info.match(/maxmemory_human:(.*)/)[1];
        }else{
            total_system_memory = info.match(/total_system_memory:(.*)/)[1]
            total_system_memory_human = info.match(/total_system_memory_human:(.*)/)[1]
        }
        
        let memory:any = {
            used_memory: info.match(/used_memory:(.*)/)[1],
            used_memory_human: info.match(/used_memory_rss_human:(.*)/)[1],
            total_system_memory: total_system_memory,
            total_system_memory_human: total_system_memory_human,
        }
        memory.used_memory_total_system_memory_perc = `${(memory.used_memory/memory.total_system_memory*100).toFixed(2)}%`

        let clients = {
            connected_clients: info.match(/connected_clients:(.*)/)[1],
            blocked_clients: info.match(/blocked_clients:(.*)/)[1],
        }

        return {server, memory, clients}

    }
}