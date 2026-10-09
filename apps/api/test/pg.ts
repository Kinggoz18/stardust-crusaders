import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";

export type TestPg = {
  connectionString: string;
  stop: () => Promise<void>;
};

function adminUrlFrom(databaseUrl: string): { adminUrl: string; host: string } {
  const u = new URL(databaseUrl);
  u.pathname = "/postgres";
  return { adminUrl: u.toString(), host: u.host };
}

/**
 * Prefer DATABASE_URL (CI service / local Postgres): create an ephemeral database.
 * Fallback: embedded-postgres when USE_EMBEDDED_PG=1.
 */
export async function startTestPostgres(): Promise<TestPg> {
  if (process.env.USE_EMBEDDED_PG === "1") {
    return startEmbedded();
  }

  const base =
    process.env.DATABASE_URL ?? "postgres://stardust:stardust@127.0.0.1:5432/stardust";
  const { adminUrl } = adminUrlFrom(base);
  const dbName = `stardust_t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const admin = postgres(adminUrl, { max: 1 });
  try {
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }

  const u = new URL(base);
  u.pathname = `/${dbName}`;
  const connectionString = u.toString();

  return {
    connectionString,
    stop: async () => {
      const dropAdmin = postgres(adminUrl, { max: 1 });
      try {
        await dropAdmin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
      } finally {
        await dropAdmin.end({ timeout: 5 });
      }
    },
  };
}

async function startEmbedded(): Promise<TestPg> {
  const EmbeddedPostgres = (await import("embedded-postgres")).default;
  const dir = await mkdtemp(path.join(tmpdir(), "stardust-pg-"));
  const port = 55000 + Math.floor(Math.random() * 1000);
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "stardust",
    password: "stardust",
    port,
    persistent: false,
  });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("stardust");
  return {
    connectionString: `postgres://stardust:stardust@127.0.0.1:${port}/stardust`,
    stop: async () => {
      try {
        await pg.stop();
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
