###message create

  接口: message/create
  请求参数:

        {
            "actor":"user",
            "type": "TRANSACTION",
            "topic": "test",
            "delay": "3000"
        }

  返回:

    {
        "id": "1",
        "type": "TRANSACTION",
        "topic": "test",
        "status": "PENDING",
        "job_id": 1,
        "updated_at": "0",
        "created_at": "1583893390398",
        "producer": "user",
        "subtasks": [],
        "job": {
            "id": 1,
            "type": "TRANSACTION",
            "message_id": "1"
        }
    }

###subtask create

  接口: message/subtask
  请求参数:

        {
            "actor":"user",
            "message_id":'3',
            "type": "ec|tcc",
            "process": "post@update",
            "data":{}
        }

  返回:

    {
      id: '1',
      job_id: -1,
      type: 'TCC',
      status: 'PREPARED',
      data: { title: 'new post' },
      created_at: '1584156250751',
      updated_at: '1584156250751',
      processer: 'user',
      prepareResult: { title: 'get new post' }
    }


###message confirm

  接口: message/confirm
  请求参数:

        {
            "actor":"user",
            "message_id":"3"
        }

  返回:

        {
            "id": "3",
            "type": "TRANSACTION",
            "topic": "test",
            "status": "DOING",
            "job_id": 3,
            "updated_at": "1583898711413",
            "created_at": "1583898711399",
            "producer": "user",
            "subtasks": [],
            "job": {
                "id": 3,
                "type": "TRANSACTION",
                "message_id": "3"
            }
        }

###message cancel

  接口: message/cancel
  请求参数:

        {
            "actor":"user",
            "message_id":"3"
        }

  返回:

        {
            "id": "5",
            "type": "TRANSACTION",
            "topic": "test",
            "status": "CANCELLING",
            "job_id": 5,
            "updated_at": "1583898848469",
            "created_at": "1583898848457",
            "producer": "user",
            "subtasks": [],
            "job": {
                "id": 5,
                "type": "TRANSACTION",
                "message_id": "5"
            }
        }