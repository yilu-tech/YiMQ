#!/usr/bin/env node
const { program } = require("@caporal/core")
import {run_01_migrate_02} from "./migrations/0.1_migrate_0.2"
import { reload } from './Core/Reload';
import { pause } from './Core/pause';
import { resume } from './Core/Resume';
import {run_02_migrate_10} from "./migrations/0.2_migrate_1.0"
import {clear_abnormal_job_index} from './Core/clear_abnormal_job_index'
import {clear_abnormal_job} from './Core/clear_abnormal_job'
import { fix_message_status } from './Core/fix_message_status'


program.command("reload", "重新加载配置文件")
.argument("[name]",'Actor名称.')
.option("-a, --all", "加载全部")
.action(reload)

program.command("pause", "暂停队列").action(pause)
program.command("resume", "启动队列").action(resume)
program.command("clear:abnormal:job:index", "清理context不存在的Job索引").action(clear_abnormal_job_index)
program.command("clear:abnormal:job", "清理message或subtask不存在的job").action(clear_abnormal_job)
program.command("fix:message:status", "修复message状态").action(fix_message_status)
program.command("migrate:01_02", "升级到v0.2").action(run_01_migrate_02)
program.command("migrate:02_10", "升级到v1.0").action(run_02_migrate_10)
program.run()