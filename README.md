#YiMQ


###事务类型
1. EC  (eventually consistent)
2. TCC (try confirm cancel)
3. XA  




###环境变量

1. CONFIG_DIR_PATH (配置文件路径)
2. TRANSACATION_MESSAGE_JOB_DELAY (message job 默认等待时间 )
3. SUBTASK_JOB_DELAY (subtask job 延迟时间 )
4. SUBTASK_JOB_BACKOFF_DELAY (subtask job重试延迟时间 )

##命令

1. yimq reload [actor_name]/--all
2. yimq pause
3. yimq resume

##管理接口

1. /admin  获取各种基础信息

        response
        {
            "version": "0.1.9",
            "master_redis": {},
            "servers": [],
            "actors": []
        }

1. /admin/reload (重新加载配置文件)

2. /actor/clearfailed (获取清理失败的message和process)
   
    query:

        {
            actor_id: 1 //为空的情况下，返回所有actor的错误message和process_ids
        }
   

3. /admin/actor/clearfailed/retry (重试清理错误)

    body:

        {

            "actor_id":20,
            "message_ids": "*",
            "process_ids": "*"
        }

        {

            "actor_id":20,
            "message_ids": [1,2],
            "process_ids": [2,3]
        }

4. /admin/actor/jobs

    query:

    actor_id:1
    status: 'completed,waiting,active,delayed,failed,paused',
    start:0
    size:2
    sort: asc|desc

5. /admin/actor/status

    query:

        {
            actor_id: 1
        }

6. /admin/actor/job

    query
    {
        actor_id: 1,
        job_id: 38
    }

7. /admin/message

    query
    {
        actor_id: 1,
        message_id: 38
    }

8.  /admin/actor/job/retry

    body
    
    {
        "actor_id":1,
        "job_ids": "*"
    }
    
9.  /admin/messages

    query

    actor_id:1
    start:0
    size:1
    sort:asc
    topic:user.create
    status: CANCELED,CANCELLING,DOING,DONE,PENDING
    clear_status: WAITING|FAILED
    message_id:23
    subtask_id:25
    job_id:2180


## boostrap流程


## reload流程



## shutdown流程



## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0.html) Copyright (C) Apache Software Foundation