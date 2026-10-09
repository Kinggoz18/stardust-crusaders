import { createDb } from "./client.js";
import { migrateDown, migrateUp } from "./migrator.js";
import { startTestPostgres, type TestPg } from "../../test/pg.js";

let pg: TestPg | undefined;
try {
  pg = await startTestPostgres();
  const { sql } = createDb(pg.connectionString);
  const up = await migrateUp(sql);
  console.log("up:", up.join(", ") || "(none)");
  const down = await migrateDown(sql, up.length || 1);
  console.log("down:", down.join(", ") || "(none)");
  const up2 = await migrateUp(sql);
  console.log("up again:", up2.join(", ") || "(none)");
  await sql.end({ timeout: 5 });
  console.log("migrate-check: ok");
} catch (err) {
  console.error("migrate-check failed:", err);
  process.exitCode = 1;
} finally {
  await pg?.stop();
}
