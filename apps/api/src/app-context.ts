import type { Config } from "./config.js";
import { createDb, type Db } from "./db/client.js";
import { AccountsService } from "./modules/accounts/service.js";

export type AppContext = {
  config: Config;
  db: Db["db"];
  sql: Db["sql"];
  accounts: AccountsService;
};

export function createAppContext(config: Config, databaseUrl = config.DATABASE_URL): AppContext {
  const { db, sql } = createDb(databaseUrl);
  return {
    config,
    db,
    sql,
    accounts: new AccountsService(db, config),
  };
}
