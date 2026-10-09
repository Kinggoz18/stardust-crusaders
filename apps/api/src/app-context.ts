import type { Config } from "./config.js";
import { createDb, type Db } from "./db/client.js";
import { AccountsService } from "./modules/accounts/service.js";
import { ProgressService } from "./modules/progress/service.js";
import { WalletService } from "./modules/wallet/service.js";

export type AppContext = {
  config: Config;
  db: Db["db"];
  sql: Db["sql"];
  accounts: AccountsService;
  progress: ProgressService;
  wallet: WalletService;
};

export function createAppContext(config: Config, databaseUrl = config.DATABASE_URL): AppContext {
  const { db, sql } = createDb(databaseUrl);
  return {
    config,
    db,
    sql,
    accounts: new AccountsService(db, config),
    progress: new ProgressService(db),
    wallet: new WalletService(db),
  };
}
