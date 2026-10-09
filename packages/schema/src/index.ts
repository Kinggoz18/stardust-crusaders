export { errorBodySchema, type ErrorBody } from "./errors.js";

export {
  consentFlagsSchema,
  linkProviderSchema,
  createAnonymousAccountRequestSchema,
  createAnonymousAccountResponseSchema,
  refreshTokenRequestSchema,
  linkAccountRequestSchema,
  linkAccountResponseSchema,
  accountExportSchema,
  type ConsentFlags,
  type LinkProvider,
  type CreateAnonymousAccountRequest,
  type CreateAnonymousAccountResponse,
} from "./accounts.js";

export {
  oneSparkProgressSchema,
  oneSparkEconomySchema,
  oneSparkDailyWalletSchema,
  mergeStars,
  mergeAlbum,
  assertOneSparkSanity,
  type OneSparkProgress,
} from "./games/one-spark.js";

export { loomRushProgressSchema, type LoomRushProgress } from "./games/loom-rush.js";

export {
  islandSnapshotSchema,
  borrowedTimeEventSchema,
  borrowedTimeCommandSchema,
  borrowedTimeProgressSchema,
  type IslandSnapshot,
  type BorrowedTimeProgress,
} from "./games/borrowed-time.js";

export {
  gameIdSchema,
  GAME_IDS,
  progressDocumentSchema,
  progressSchemaFor,
  putProgressRequestSchema,
  putProgressResponseSchema,
  staleRevisionErrorSchema,
  type GameId,
} from "./games/registry.js";

export {
  walletReasonSchema,
  walletLedgerEntrySchema,
  postWalletEntryRequestSchema,
  type WalletLedgerEntry,
} from "./wallet.js";

export {
  telemetryEventSchema,
  postEventsRequestSchema,
  postEventsResponseSchema,
  FUNNEL_EVENT_NAMES,
  type TelemetryEvent,
} from "./telemetry.js";

export {
  adProviderNameSchema,
  adRewardCallbackSchema,
  adRewardResponseSchema,
  type AdRewardCallback,
} from "./ads.js";

export {
  revenueCatEventSchema,
  revenueCatWebhookResponseSchema,
  type RevenueCatEvent,
} from "./iap.js";

export {
  staffRoleSchema,
  staffLoginRequestSchema,
  staffLoginResponseSchema,
  auditActionSchema,
  auditEntrySchema,
  type StaffRole,
} from "./admin.js";
