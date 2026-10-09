import type { Config } from "./config.js";
import { createDb, type Db } from "./db/client.js";
import { AccountsService } from "./modules/accounts/service.js";
import { ProgressService } from "./modules/progress/service.js";
import { WalletService } from "./modules/wallet/service.js";
import { TelemetryService } from "./modules/telemetry/service.js";
import { AdsService } from "./modules/ads/service.js";
import { createAdProvider } from "./modules/ads/provider.js";
import { IapService } from "./modules/iap/service.js";

export type AppContext = {
  config: Config;
  db: Db["db"];
  sql: Db["sql"];
  accounts: AccountsService;
  progress: ProgressService;
  wallet: WalletService;
  telemetry: TelemetryService;
  ads: AdsService;
  iap: IapService;
};

export function createAppContext(config: Config, databaseUrl = config.DATABASE_URL): AppContext {
  const { db, sql } = createDb(databaseUrl);
  const wallet = new WalletService(db);
  const adProvider = createAdProvider(config.AD_PROVIDER, config.AD_PROVIDER_SIGNING_SECRET);
  return {
    config,
    db,
    sql,
    accounts: new AccountsService(db, config),
    progress: new ProgressService(db),
    wallet,
    telemetry: new TelemetryService(db),
    ads: new AdsService(db, adProvider, wallet),
    iap: new IapService(db, config.REVENUECAT_WEBHOOK_SECRET),
  };
}
