import { loadConfig } from "../../config.js";
import { createDb } from "../../db/client.js";
import { migrateUp } from "../../db/migrator.js";
import { rollupDay, yesterdayUtc } from "./rollup.js";

function parseDayArg(argv: string[]): string {
  const flag = argv.find((a) => a.startsWith("--day="));
  if (flag) return flag.slice("--day=".length);
  const idx = argv.indexOf("--day");
  if (idx >= 0 && argv[idx + 1]) return argv[idx + 1]!;
  return yesterdayUtc();
}

const day = parseDayArg(Bun.argv);
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
  console.error("metrics:rollup expects --day=YYYY-MM-DD");
  process.exit(1);
}

const config = loadConfig();
const { db, sql } = createDb(config.DATABASE_URL);
await migrateUp(sql);
const result = await rollupDay(db, day);
console.log(JSON.stringify(result));
await sql.end({ timeout: 5 });
