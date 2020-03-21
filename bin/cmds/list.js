const { spawn } = require('child_process');


module.exports = ()=>{
    const spawnObj = spawn('pm2', ['ls']);
    spawnObj.stdout.pipe(process.stdout)
    spawnObj.stderr.pipe(process.stderr)
}
