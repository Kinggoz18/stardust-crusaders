import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type postgres from "postgres";

const MIGRATIONS_DIR = path.resolve(import.meta.dir, "../../drizzle");

export type MigrationFile = { id: string; up: string; down: string };

export async function listMigrations(): Promise<MigrationFile[]> {
  const files = await readdir(MIGRATIONS_DIR);
  const ups = files.filter((f) => f.endsWith(".sql") && !f.endsWith(".down.sql")).sort();
  const result: MigrationFile[] = [];
  for (const upName of ups) {
    const id = upName.replace(/\.sql$/, "");
    const downName = `${id}.down.sql`;
    if (!files.includes(downName)) {
      throw new Error(`Missing down migration for ${id}`);
    }
    result.push({
      id,
      up: await readFile(path.join(MIGRATIONS_DIR, upName), "utf8"),
      down: await readFile(path.join(MIGRATIONS_DIR, downName), "utf8"),
    });
  }
  return result;
}

export async function migrateUp(sql: postgres.Sql): Promise<string[]> {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id varchar(128) PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  const applied = new Set(
    (await sql<{ id: string }[]>`SELECT id FROM schema_migrations`).map((r) => r.id),
  );
  const appliedNow: string[] = [];
  for (const m of await listMigrations()) {
    if (applied.has(m.id)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(m.up);
      await tx`INSERT INTO schema_migrations (id) VALUES (${m.id}) ON CONFLICT DO NOTHING`;
    });
    appliedNow.push(m.id);
  }
  return appliedNow;
}

export async function migrateDown(sql: postgres.Sql, steps = 1): Promise<string[]> {
  const rows = await sql<{ id: string }[]>`
    SELECT id FROM schema_migrations ORDER BY applied_at DESC LIMIT ${steps}
  `;
  const migrations = await listMigrations();
  const byId = new Map(migrations.map((m) => [m.id, m]));
  const rolled: string[] = [];
  for (const row of rows) {
    const m = byId.get(row.id);
    if (!m) throw new Error(`Unknown migration ${row.id}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(m.down);
      await tx`DELETE FROM schema_migrations WHERE id = ${row.id}`;
    });
    rolled.push(row.id);
  }
  return rolled;
}
