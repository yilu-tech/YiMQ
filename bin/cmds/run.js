const { spawn } = require('child_process');
var path = require('path');



let ecosystemFile = path.join(__dirname, '../../ecosystem.config.js');
module.exports = ()=>{
    const child = spawn('pm2-runtime',['start',ecosystemFile,'--formatted']);
    child.stdout.pipe(process.stdout);  // 将子进程的输出(stdout)输出到父进程的stdout中
    child.stderr.pipe(process.stderr); 
}