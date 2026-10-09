import { buildServer } from "./server.js";
import { loadConfig } from "./config.js";
import { createAppContext } from "./app-context.js";
import { migrateUp } from "./db/migrator.js";

const config = loadConfig();
const ctx = createAppContext(config);
await migrateUp(ctx.sql);
const app = await buildServer(config, ctx);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutting down");
  await app.close();
  await ctx.sql.end({ timeout: 5 });
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await app.listen({ port: config.PORT, host: config.HOST });
app.log.info({ port: config.PORT }, "api listening");
