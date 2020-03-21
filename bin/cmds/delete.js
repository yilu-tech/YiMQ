var pm2Tool = require('../libs/pm2Tool')
var pm2 = require('pm2');


module.exports = ()=>{
    pm2.connect( async(err)=>{
        if (err) {
            console.error(err);
            process.exit(2);
        }

        let instances = await pm2Tool.describe('yimq')
        instances.forEach(element => {
            console.info(`${element.name} ${element.pm_id} is ${element.pm2_env.status}.`)
        });

        console.info('.........')
    
        
        instances = await pm2Tool.delete('yimq')
        instances.forEach(element => {
            console.info(`${element.name} ${element.pm_id} is ${element.status}.`)
        });
        pm2.disconnect()
    })
}
