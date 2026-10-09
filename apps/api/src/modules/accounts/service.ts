import { eq, and, isNull } from "drizzle-orm";
import {
  createAnonymousAccountRequestSchema,
  linkAccountRequestSchema,
  type CreateAnonymousAccountRequest,
} from "@stardust/schema";
import type { Db } from "../../db/client.js";
import { accounts, refreshTokens } from "../../db/schema.js";
import { randomToken, sha256, signJwt } from "../../lib/crypto.js";
import type { Config } from "../../config.js";

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export class AccountsService {
  constructor(
    private readonly db: Db["db"],
    private readonly config: Config,
  ) {}

  async createAnonymous(input: CreateAnonymousAccountRequest) {
    const body = createAnonymousAccountRequestSchema.parse(input);

    const existing = await this.db.query.accounts.findFirst({
      where: and(eq(accounts.deviceId, body.deviceId), isNull(accounts.deletedAt)),
    });

    let accountId: string;
    if (existing) {
      accountId = existing.id;
      await this.db
        .update(accounts)
        .set({
          consentAnalytics: body.consent.analytics,
          consentCrash: body.consent.crashReports,
          consentMarketing: body.consent.marketing,
          platform: body.platform,
          updatedAt: new Date(),
        })
        .where(eq(accounts.id, existing.id));
    } else {
      const [row] = await this.db
        .insert(accounts)
        .values({
          deviceId: body.deviceId,
          platform: body.platform,
          consentAnalytics: body.consent.analytics,
          consentCrash: body.consent.crashReports,
          consentMarketing: body.consent.marketing,
        })
        .returning();
      accountId = row.id;
    }

    return this.issueTokens(accountId);
  }

  async refresh(refreshToken: string) {
    const hash = sha256(refreshToken);
    const row = await this.db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.tokenHash, hash),
    });
    if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
      return null;
    }
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, row.id));
    return this.issueTokens(row.accountId);
  }

  /** Stub: validates contract, stores provider subject, does not call Apple/Google. */
  async linkAccount(accountId: string, raw: unknown) {
    const body = linkAccountRequestSchema.parse(raw);
    await this.db
      .update(accounts)
      .set({
        linkProvider: body.provider,
        linkSubject: `stub:${body.provider}:${sha256(body.idToken).slice(0, 16)}`,
        email: body.provider === "email" ? body.idToken : null,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, accountId));
    return { linked: true as const, provider: body.provider, stub: true as const };
  }

  async exportAccount(accountId: string) {
    const account = await this.db.query.accounts.findFirst({
      where: eq(accounts.id, accountId),
    });
    if (!account || account.deletedAt) return null;
    return {
      accountId: account.id,
      createdAt: account.createdAt.toISOString(),
      consent: {
        analytics: account.consentAnalytics,
        crashReports: account.consentCrash,
        marketing: account.consentMarketing,
      },
      games: {},
      wallet: [],
      events: [],
    };
  }

  async deleteAccount(accountId: string) {
    await this.db
      .update(accounts)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(accounts.id, accountId));
    await this.db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.accountId, accountId));
    return { deleted: true };
  }

  private async issueTokens(accountId: string) {
    const accessToken = await signJwt(
      { sub: accountId, typ: "access" },
      this.config.JWT_SECRET,
      ACCESS_TTL,
    );
    const refreshToken = randomToken(48);
    await this.db.insert(refreshTokens).values({
      accountId,
      tokenHash: sha256(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    });
    return {
      accountId,
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TTL,
    };
  }
}
