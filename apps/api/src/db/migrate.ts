import { loadConfig } from "../config.js";
import { createDb } from "./client.js";
import { migrateUp } from "./migrator.js";

const config = loadConfig();
const { sql } = createDb(config.DATABASE_URL);
try {
  const applied = await migrateUp(sql);
  console.log("migrate up:", applied.length ? applied.join(", ") : "already up to date");
} finally {
  await sql.end({ timeout: 5 });
}
