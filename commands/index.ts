const { program } = require("@caporal/core")
import {run_01_migrate_02} from "./migrations/0.1_migrate_0.2"
import { reload } from './Core/Reload';



program.command("reload", "重新加载配置文件").action(reload)

program.command("migrate:01_02", "升级到v2").action(run_01_migrate_02)

program.run()