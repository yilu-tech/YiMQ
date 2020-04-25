var path = require('path');
let mainFilePath = path.join(__dirname, './dist/src/main.js');
module.exports = {
  apps : [{
    name: 'yimq',
    script: mainFilePath,
    instances: 1,
    autorestart: true,
    watch: true,
    max_memory_restart: '1G',
    mergeLogs: false,
    wait_ready: true,
    listen_timeout: 100000,
    kill_timeout:1000*20,
    formatted: true,
    env: {
      NODE_ENV: 'dev'
    },
    env_production: {
      NODE_ENV: 'prod'
    }
  }],
};
