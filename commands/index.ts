const { program } = require("@caporal/core")
import {run_01_migrate_02} from "./migrations/0.1_migrate_0.2"

program.command("migrate:01_02", "升级到v2").action(run_01_migrate_02)

program.run()