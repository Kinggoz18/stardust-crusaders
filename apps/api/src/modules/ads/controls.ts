import { and, desc, eq, isNull } from "drizzle-orm";
import {
  adminGameAdsSettingsSchema,
  adminGameAdsSettingsUpdateSchema,
  GAME_IDS,
  gameIdSchema,
  houseAdCreateSchema,
  houseAdRecordSchema,
  houseAdUpdateSchema,
  houseAdsAdminListSchema,
  houseAdsGlobalUpdateSchema,
  type GameId,
  type StaffRole,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import {
  adFrequencyCaps,
  adUnits,
  houseAds,
  houseAdsGame,
  houseAdsGlobal,
} from "../../db/schema.js";
import type { AdminAuthService, StaffContext } from "../admin/auth.js";

export class AdControlsService {
  constructor(
    private readonly db: Db["db"],
    private readonly auth: AdminAuthService,
  ) {}

  private allowWrite(staff: StaffContext) {
    this.auth.requireRole(staff, ["owner", "support"] as StaffRole[]);
  }

  private allowOwner(staff: StaffContext) {
    this.auth.requireRole(staff, ["owner"] as StaffRole[]);
  }

  async getGameSettings(staff: StaffContext, gameIdRaw: string) {
    this.allowWrite(staff);
    const gameId = gameIdSchema.parse(gameIdRaw);
    const interstitial = await this.cap(gameId, "interstitial");
    const rewarded = await this.cap(gameId, "rewarded");
    const units = await this.db.query.adUnits.findMany({
      where: eq(adUnits.gameId, gameId),
    });
    const houseGame = await this.db.query.houseAdsGame.findFirst({
      where: eq(houseAdsGame.gameId, gameId),
    });
    return adminGameAdsSettingsSchema.parse({
      gameId,
      interstitial: {
        enabled: interstitial.enabled,
        minTransitions: interstitial.minTransitions,
        maxTransitions: interstitial.maxTransitions,
        maxPerSession: interstitial.maxPerSession,
        unitId: units.find((u) => u.format === "interstitial")?.unitId ?? "",
      },
      rewarded: {
        enabled: rewarded.enabled,
        maxPerSession: rewarded.maxPerSession,
        unitId: units.find((u) => u.format === "rewarded")?.unitId ?? "",
      },
      houseAdsGameEnabled: houseGame?.enabled ?? false,
    });
  }

  async updateGameSettings(staff: StaffContext, gameIdRaw: string, raw: unknown) {
    this.allowWrite(staff);
    const gameId = gameIdSchema.parse(gameIdRaw);
    const body = adminGameAdsSettingsUpdateSchema.parse(raw);
    const now = new Date();

    await this.upsertCap(gameId, "interstitial", {
      enabled: body.interstitial.enabled,
      minTransitions: body.interstitial.minTransitions,
      maxTransitions: body.interstitial.maxTransitions,
      maxPerSession: body.interstitial.maxPerSession,
    });
    await this.upsertCap(gameId, "rewarded", {
      enabled: body.rewarded.enabled,
      minTransitions: 1,
      maxTransitions: 1,
      maxPerSession: body.rewarded.maxPerSession,
    });

    await this.db
      .insert(adUnits)
      .values({
        gameId,
        format: "interstitial",
        unitId: body.interstitial.unitId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [adUnits.gameId, adUnits.format],
        set: { unitId: body.interstitial.unitId, updatedAt: now },
      });
    await this.db
      .insert(adUnits)
      .values({
        gameId,
        format: "rewarded",
        unitId: body.rewarded.unitId,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [adUnits.gameId, adUnits.format],
        set: { unitId: body.rewarded.unitId, updatedAt: now },
      });

    if (body.houseAdsGameEnabled !== undefined) {
      await this.db
        .insert(houseAdsGame)
        .values({ gameId, enabled: body.houseAdsGameEnabled, updatedAt: now })
        .onConflictDoUpdate({
          target: houseAdsGame.gameId,
          set: { enabled: body.houseAdsGameEnabled, updatedAt: now },
        });
    }

    await this.auth.audit(staff.staffId, "ad_settings_update", "game", gameId, {
      interstitial: body.interstitial,
      rewarded: body.rewarded,
      houseAdsGameEnabled: body.houseAdsGameEnabled,
    });
    return this.getGameSettings(staff, gameId);
  }

  async listHouseAds(staff: StaffContext) {
    this.allowWrite(staff);
    const global = await this.ensureGlobal();
    const games = await this.db.select().from(houseAdsGame);
    const items = await this.db.select().from(houseAds).orderBy(desc(houseAds.createdAt));
    return houseAdsAdminListSchema.parse({
      global: {
        enabled: global.enabled,
        killSwitch: global.killSwitch,
        updatedAt: global.updatedAt.toISOString(),
      },
      games: GAME_IDS.map((id) => ({
        gameId: id,
        enabled: games.find((g) => g.gameId === id)?.enabled ?? false,
      })),
      items: items.map(mapHouseAd),
    });
  }

  async updateGlobal(staff: StaffContext, raw: unknown) {
    const body = houseAdsGlobalUpdateSchema.parse(raw);
    if (body.enabled === true) {
      this.allowOwner(staff);
    } else {
      this.allowWrite(staff);
    }
    const now = new Date();
    const current = await this.ensureGlobal();
    const enabled = body.enabled ?? current.enabled;
    const killSwitch = body.killSwitch ?? current.killSwitch;
    await this.db
      .update(houseAdsGlobal)
      .set({ enabled, killSwitch, updatedAt: now })
      .where(eq(houseAdsGlobal.id, 1));
    await this.auth.audit(staff.staffId, "house_ads_global_update", "house_ads", "global", {
      enabled,
      killSwitch,
      previous: { enabled: current.enabled, killSwitch: current.killSwitch },
    });
    return this.listHouseAds(staff);
  }

  async createHouseAd(staff: StaffContext, raw: unknown) {
    this.allowWrite(staff);
    const body = houseAdCreateSchema.parse(raw);
    const [row] = await this.db
      .insert(houseAds)
      .values({
        promotedGame: body.promotedGame,
        creativeRef: body.creativeRef,
        targetGames: body.targetGames,
        platform: body.platform ?? null,
        enabled: body.enabled ?? false,
        maxPerSession: body.maxPerSession ?? 1,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
      })
      .returning();
    await this.auth.audit(staff.staffId, "house_ad_create", "house_ad", row!.id, {
      promotedGame: body.promotedGame,
      targetGames: body.targetGames,
    });
    return houseAdRecordSchema.parse(mapHouseAd(row!));
  }

  async updateHouseAd(staff: StaffContext, id: string, raw: unknown) {
    this.allowWrite(staff);
    const body = houseAdUpdateSchema.parse(raw);
    if (body.promotedGame || body.targetGames) {
      const existing = await this.db.query.houseAds.findFirst({ where: eq(houseAds.id, id) });
      if (!existing) {
        throw notFound("House ad not found.");
      }
      const promoted = body.promotedGame ?? existing.promotedGame;
      const targets = body.targetGames ?? existing.targetGames;
      houseAdCreateSchema.parse({
        promotedGame: promoted,
        creativeRef: body.creativeRef ?? existing.creativeRef,
        targetGames: targets,
      });
    }
    const [row] = await this.db
      .update(houseAds)
      .set({
        ...(body.promotedGame ? { promotedGame: body.promotedGame } : {}),
        ...(body.creativeRef ? { creativeRef: body.creativeRef } : {}),
        ...(body.targetGames ? { targetGames: body.targetGames } : {}),
        ...(body.platform !== undefined ? { platform: body.platform } : {}),
        ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
        ...(body.maxPerSession !== undefined ? { maxPerSession: body.maxPerSession } : {}),
        ...(body.startsAt !== undefined
          ? { startsAt: body.startsAt ? new Date(body.startsAt) : null }
          : {}),
        ...(body.endsAt !== undefined
          ? { endsAt: body.endsAt ? new Date(body.endsAt) : null }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(houseAds.id, id))
      .returning();
    if (!row) throw notFound("House ad not found.");
    await this.auth.audit(staff.staffId, "house_ad_update", "house_ad", id, body);
    return houseAdRecordSchema.parse(mapHouseAd(row));
  }

  async deleteHouseAd(staff: StaffContext, id: string) {
    this.allowWrite(staff);
    const [row] = await this.db.delete(houseAds).where(eq(houseAds.id, id)).returning();
    if (!row) throw notFound("House ad not found.");
    await this.auth.audit(staff.staffId, "house_ad_delete", "house_ad", id, {
      promotedGame: row.promotedGame,
    });
    return { ok: true as const };
  }

  private async cap(gameId: GameId, placement: string) {
    const row = await this.db.query.adFrequencyCaps.findFirst({
      where: and(
        eq(adFrequencyCaps.gameId, gameId),
        isNull(adFrequencyCaps.accountId),
        eq(adFrequencyCaps.placement, placement),
      ),
    });
    if (row) return row;
    return {
      enabled: placement !== "house",
      minTransitions: placement === "interstitial" ? 4 : 1,
      maxTransitions: placement === "interstitial" ? 6 : 1,
      maxPerSession: placement === "interstitial" ? 3 : 20,
    };
  }

  private async upsertCap(
    gameId: GameId,
    placement: string,
    values: {
      enabled: boolean;
      minTransitions: number;
      maxTransitions: number;
      maxPerSession: number;
    },
  ) {
    const existing = await this.db.query.adFrequencyCaps.findFirst({
      where: and(
        eq(adFrequencyCaps.gameId, gameId),
        isNull(adFrequencyCaps.accountId),
        eq(adFrequencyCaps.placement, placement),
      ),
    });
    if (existing) {
      await this.db
        .update(adFrequencyCaps)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(adFrequencyCaps.id, existing.id));
      return;
    }
    await this.db.insert(adFrequencyCaps).values({
      gameId,
      accountId: null,
      placement,
      ...values,
    });
  }

  private async ensureGlobal() {
    const row = await this.db.query.houseAdsGlobal.findFirst({
      where: eq(houseAdsGlobal.id, 1),
    });
    if (row) return row;
    const [created] = await this.db
      .insert(houseAdsGlobal)
      .values({ id: 1, enabled: false, killSwitch: false })
      .returning();
    return created!;
  }
}

function mapHouseAd(row: typeof houseAds.$inferSelect) {
  return {
    id: row.id,
    promotedGame: row.promotedGame,
    creativeRef: row.creativeRef,
    targetGames: row.targetGames,
    platform: row.platform as "android" | "ios" | null,
    enabled: row.enabled,
    maxPerSession: row.maxPerSession,
    startsAt: row.startsAt ? row.startsAt.toISOString() : null,
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function notFound(message: string) {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  err.code = "not_found";
  return err;
}
