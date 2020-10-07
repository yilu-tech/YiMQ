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

###管理接口

1. /admin/reload (重新加载配置文件)

2. /actor/clearfailed (获取清理失败的message和process)
   
   query:
   {
       actor_id: 1
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






## License
[Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0.html) Copyright (C) Apache Software Foundation