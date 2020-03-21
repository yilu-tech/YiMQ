var pm2 = require('pm2');
var pm2Tool = require('../libs/pm2Tool')
var path = require('path');


let mainFilePath = path.join(__dirname, '../../dist/main.js');

module.exports = ()=>{
    pm2.connect(async (err)=>{
        if (err) {
            console.error(err);
            process.exit(2);
        }
    
        try {
            let instances = await pm2Tool.start({
                name: 'yimq',
                script: mainFilePath,         // Script to be run
                exec_mode: 'cluster',        // Allows your app to be clustered
                instances: 'auto',                // Optional: Scales your app by 4
                max_memory_restart: '1024M',   // Optional: Restarts your app if it reaches 100Mo
                output: path.join(process.cwd(),'logs/output.log'),
                error: path.join(process.cwd(),'logs/error.log'),
                mergeLogs: true,
            });
            instances.forEach(element => {
                let pm2_env = element.pm2_env;
                console.info(`${pm2_env.name} ${pm2_env.pm_id} is ${pm2_env.status}.`)
            });
        } catch (error) {
            console.error(error)
        }

        pm2.disconnect()
    });

}
