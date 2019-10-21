


###创建事物

  接口: http://localhost:3000/transactions
  请求参数:

    {
      "coordinator": "transaction",
      "name": "send_message",
      "sender": {
        "name":"mix",
        "header":{}
      }
    }

    {
      "coordinator": "transaction",
      "service_key: "",
      "transaction_tag": "send_message",
    }

  返回:

    {
      "id": "8",
      "name": "send_message",
      "items": [],
      "total": 0
    }


###添加 延迟任务

  接口: http://localhost:3000/transactions/jobs/delay
  请求参数: 

    {
      "coordinator": "transaction",
      "id":"8",
      "item":{
        "type":"delay",
        "url":"http://api.d.yilu.co",
        "data":{}
      }
    }
  
  返回:

    {
      "id": "8",
      "name": "send_message",
      "sender": {
        "name": "mix",
        "header": {}
      },
      "items": [
        {
          "type": "delay",
          "url": "http://api.d.yilu.co",
          "data": {},
          "id": 1,
          "status": "WAITING",
          "attemptsMade": 0
        }
      ],
      "total": 1
    }


###提交事物

  接口: http://localhost:3000/transactions/commit

  请求参数:

    {
      "coordinator": "transaction",
      "id":"8"
    }

  返回:




###回滚事物

  接口: http://localhost:3000/transactions/rollback
  
  请求参数:

    {
      "coordinator": "transaction",
      "id":"3"
    }

  返回:


