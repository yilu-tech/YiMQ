
var grpc = require('grpc')

var path = require('path');

var PROTO_PATH = path.join(process.cwd(), 'protos/yimq.proto');
var yimq = grpc.load(PROTO_PATH).yimq

var conf = {
    port: '8379',
    ip: {
      client: '127.0.0.1'
    }
  }
function endCallback() {
    console.log('end')
}

var client = new yimq.MessageService(conf.ip.client + ':' + conf.port, grpc.credentials.createInsecure())

for(var i =0;i<1;i++){
  let body = {
    actor:'user',
    type:'BROADCAST',
    topic:'user.update'
  }
  client.create(body,function(err, response){
      console.log(response)
  });
}
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