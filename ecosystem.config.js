var path = require('path');
let mainFilePath = path.join(__dirname, './dist/main.js');
module.exports = {
  apps : [{
    name: 'yimq',
    script: mainFilePath,
    instances: 2,
    autorestart: true,
    watch: false,
    max_memory_restart: '2G',
    mergeLogs: false,
    wait_ready: true,
    listen_timeout: 1000*10,
    kill_timeout: 1000 * 30,//shutdown超时时间
    formatted: true,
    env: {
      NODE_ENV: 'dev'
    },
    env_production: {
      NODE_ENV: 'prod'
    }
  }],
};
