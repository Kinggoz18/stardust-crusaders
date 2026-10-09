import type { Config } from "./config.js";
import { createDb, type Db } from "./db/client.js";
import { AccountsService } from "./modules/accounts/service.js";
import { ProgressService } from "./modules/progress/service.js";
import { WalletService } from "./modules/wallet/service.js";
import { TelemetryService } from "./modules/telemetry/service.js";
import { AdsService } from "./modules/ads/service.js";
import { AdControlsService } from "./modules/ads/controls.js";
import { createAdProvider } from "./modules/ads/provider.js";
import { IapService } from "./modules/iap/service.js";
import { AdminAuthService } from "./modules/admin/auth.js";
import { AdminService } from "./modules/admin/service.js";
import { MetricsService } from "./modules/metrics/service.js";

export type AppContext = {
  config: Config;
  db: Db["db"];
  sql: Db["sql"];
  accounts: AccountsService;
  progress: ProgressService;
  wallet: WalletService;
  telemetry: TelemetryService;
  ads: AdsService;
  adControls: AdControlsService;
  iap: IapService;
  adminAuth: AdminAuthService;
  admin: AdminService;
  metrics: MetricsService;
};

export function createAppContext(config: Config, databaseUrl = config.DATABASE_URL): AppContext {
  const { db, sql } = createDb(databaseUrl);
  const wallet = new WalletService(db);
  const adProvider = createAdProvider(config.AD_PROVIDER, {
    signingSecret: config.AD_PROVIDER_SIGNING_SECRET,
    keysUrl: config.ADMOB_SSV_KEYS_URL,
    maxAgeMs: config.ADMOB_SSV_MAX_AGE_MS,
  });
  const adminAuth = new AdminAuthService(db, config.ADMIN_MASTER_KEY);
  const metrics = new MetricsService(db, adminAuth);
  return {
    config,
    db,
    sql,
    accounts: new AccountsService(db, config),
    progress: new ProgressService(db),
    wallet,
    telemetry: new TelemetryService(db),
    ads: new AdsService(db, adProvider, wallet),
    adControls: new AdControlsService(db, adminAuth),
    iap: new IapService(db, config.REVENUECAT_WEBHOOK_SECRET),
    adminAuth,
    admin: new AdminService(db, adminAuth, metrics),
    metrics,
  };
}

/** Test helper: build context with a custom ad provider. */
export function createAppContextWithAds(
  config: Config,
  databaseUrl: string,
  adProvider: ReturnType<typeof createAdProvider>,
): AppContext {
  const base = createAppContext(config, databaseUrl);
  return {
    ...base,
    ads: new AdsService(base.db, adProvider, base.wallet),
  };
}
