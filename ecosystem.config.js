var path = require('path');
module.exports = {
  apps : [{
    name: 'yimq',
    script: 'dist/main.js',
    instances: 'auto',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    mergeLogs: false,
    wait_ready: true,
    listen_timeout: 100000,
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }],
};
