var pm2Tool = require('../libs/pm2Tool')
var pm2 = require('pm2');
var pm2_bus = require('pm2').pm2_bus;


module.exports = async ()=>{
    let message_id = Date.now();

    let topic = 'config_update';
    pm2.connect( async(err)=>{
        if (err) {
            console.error(err);
            process.exit(2);
        }

        let instances = await pm2Tool.describe('yimq');
        let instanceId = instances[0].pm_id;

        pm2.launchBus(function(err, bus) {
            bus.on(`process:${topic}`, function(packet) {
                if(instanceId == packet.process.pm_id && packet.data.message_id == message_id){
                    console.log(`Message ${message_id} result: ${packet.data.message}`)
                    pm2.disconnect()
                }
            });
        });
       
        
        try {
            let send  = await pm2Tool.sendDataToProcessId({
                id   : instanceId,
                topic: topic,
                data: {},
                message_id:message_id
            });
            console.log(`Message ${message_id} send success ${send.success}`);
        } catch (error) {
            console.error(error.message)
        }
        
    })





}
