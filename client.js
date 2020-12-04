
const protoLoader = require('@grpc/proto-loader');
var grpc = require('grpc')
var path = require('path');

var protoFileName = path.join(process.cwd(), 'protos/yimq.proto');
const packageDefinition = protoLoader.loadSync(protoFileName);
const packageObject = grpc.loadPackageDefinition(packageDefinition);
const yimq = packageObject.YiMQ;


var conf = {
  port: '8379',
  ip: {
    client: '127.0.0.1'
  }
}
function endCallback() {
  console.log('end')
}

var client = new yimq.ServerService(conf.ip.client + ':' + conf.port, grpc.credentials.createInsecure())

createMessage = function(body){
  return new Promise((res,rej)=>{
    client.CreateMessage(body, function (err, response) {
      if(err)return rej(err);
      res(response);
    });
  })
}

async function create() {
  let body = {
    actor: 'user',
    // type:'BROADCAST',
    // topic:'user.update'
    data: JSON.stringify({test:123})
  }

  console.time('cost..1')
  await createMessage(body);
  console.timeEnd('cost..1')

  // console.time('cost..2')
  // await createMessage(body);
  // console.timeEnd('cost..2')


  // console.time('cost..')

  // for (var i = 0; i < 5000; i++) {
  //   let body = {
  //     actor: 'user',
  //     // type:'BROADCAST',
  //     // topic:'user.update'
  //     data: JSON.stringify({ request_id: i })
  //   }
  //   let result = await createMessage(body);
  //   // console.log(result);
  
  // }
  // console.timeEnd('cost..')

}


create()



//  console.log(client)


//  function query() {
//     var call = client.findMany()

//     call.on('data', function(place) {
//         console.log(place)
//         call.write({id:place.id})
//     });
//     call.on('end', endCallback)
//     // for (var id of [1,2,3]) {
//     //     call.write({id:id})
//     // }
//     // call.end()




// }
// query();