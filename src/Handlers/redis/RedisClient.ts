import * as Ioredis from 'ioredis'

export class RedisClient extends Ioredis{

    async getInfo(){
        let info = await this.info();


        let server = {
            redis_version: info.match(/redis_version:(.*)/)[1],
            uptime_in_seconds: info.match(/uptime_in_seconds:(.*)/)[1],
            uptime_in_days: info.match(/uptime_in_days:(.*)/)[1],
        }
        let memory:any = {
            used_memory: info.match(/used_memory:(.*)/)[1],
            used_memory_human: info.match(/used_memory_rss_human:(.*)/)[1],
            total_system_memory: info.match(/total_system_memory:(.*)/)[1],
            total_system_memory_human: info.match(/total_system_memory_human:(.*)/)[1],
        }
        memory.used_memory_total_system_memory_perc = `${(memory.used_memory/memory.total_system_memory*100).toFixed(2)}%`

        let clients = {
            connected_clients: info.match(/connected_clients:(.*)/)[1],
            blocked_clients: info.match(/blocked_clients:(.*)/)[1],
        }

        return {server, memory, clients}

    }
}