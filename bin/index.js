#!/usr/bin/env node
const prog = require('caporal');
prog.version(require('../package.json').version);

prog.command('start', '启动').action(require('./cmds/start'));

prog.command('stop', '停止').action(require('./cmds/stop'));

prog.command('restart', '重启').action(require('./cmds/restart'));


prog.command('delete', '删除').alias('del').action(require('./cmds/delete'));

prog.command('list', '查看').alias('ls').action(require('./cmds/list'));

prog.command('config update', '更新').alias('ls').action(require('./cmds/config'));

prog.parse(process.argv);