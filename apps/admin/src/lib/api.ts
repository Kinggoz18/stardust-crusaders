export type ApiError = { error: { code: string; message: string } };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type") && init?.body) {
    headers.set("content-type", "application/json");
  }
  const csrf = sessionStorage.getItem("stardust_csrf");
  if (csrf && init?.method && init.method !== "GET") {
    headers.set("x-csrf-token", csrf);
  }
  const res = await fetch(`/api${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
  if (res.status === 204) return undefined as T;
  const data = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? (data as ApiError).error.message
        : "Something went wrong. Try again.";
    throw new Error(message);
  }
  return data as T;
}

export const api = {
  bootstrapStatus() {
    return request<{ needsBootstrap: boolean }>("/admin/v1/auth/bootstrap-status");
  },
  bootstrap(body: { masterKey: string; email: string; password: string }) {
    return request<{
      ok: true;
      email: string;
      role: "owner";
      totpSecret: string;
      otpauthUrl: string;
    }>("/admin/v1/auth/bootstrap", { method: "POST", body: JSON.stringify(body) });
  },
  acceptInvite(body: { token: string; password: string }) {
    return request<{
      ok: true;
      email: string;
      role: string;
      totpSecret: string;
      otpauthUrl: string;
    }>("/admin/v1/auth/accept-invite", { method: "POST", body: JSON.stringify(body) });
  },
  login(body: { email: string; password: string; totpCode: string }) {
    return request<{ ok: true; role: string; expiresAt: string; token?: string }>(
      "/admin/v1/auth/login",
      { method: "POST", body: JSON.stringify(body) },
    );
  },
  logout() {
    return request<{ ok: true }>("/admin/v1/auth/logout", { method: "POST", body: "{}" });
  },
  accounts(q: string, cursor?: string) {
    const params = new URLSearchParams({ q });
    if (cursor) params.set("cursor", cursor);
    return request<{
      accounts: Array<{
        id: string;
        deviceId: string;
        email: string | null;
        platform: string;
        bannedAt: string | null;
        createdAt: string;
      }>;
      nextCursor: string | null;
    }>(`/admin/v1/accounts?${params}`);
  },
  account(id: string) {
    return request<{
      account: {
        id: string;
        deviceId: string;
        email: string | null;
        platform: string;
        bannedAt: string | null;
        banReason: string | null;
        createdAt: string;
      };
      progress: Array<{ gameId: string; revision: number; document: unknown }>;
    }>(`/admin/v1/accounts/${id}`);
  },
  metrics() {
    return request<{
      newAccounts24h: number;
      dau: number;
      wau: number;
      mau?: number;
      retention: { d1: number | null; d7: number | null; d30?: number | null };
      asOf?: string;
    }>("/admin/v1/metrics");
  },
  metricsOverview(query: string) {
    return request<{
      newAccounts: number;
      dau: number;
      wau: number;
      mau: number;
      stickiness: number | null;
      sessions: number;
      avgSessionSec: number | null;
      retention: { d1: number | null; d7: number | null; d30: number | null };
      series: Array<{ day: string; dau: number; newAccounts: number; sessions: number }>;
    }>(`/admin/v1/metrics/overview?${query}`);
  },
  metricsRetention(query: string) {
    return request<{
      cohorts: Array<{
        cohortDay: string;
        cohortSize: number;
        d1: number | null;
        d7: number | null;
        d30: number | null;
      }>;
    }>(`/admin/v1/metrics/retention?${query}`);
  },
  metricsFunnel(query: string) {
    return request<{
      gameId: string;
      levels: Array<{
        level: number;
        starts: number;
        wins: number;
        fails: number;
        quits: number;
        avgMovesLeft: number | null;
        stars: { s0: number; s1: number; s2: number; s3: number };
      }>;
    }>(`/admin/v1/metrics/funnel?${query}`);
  },
  metricsDifficulty(query: string) {
    return request<{
      gameId: string;
      levels: Array<{
        level: number;
        starts: number;
        wins: number;
        winRate: number | null;
        bandMin: number | null;
        bandMax: number | null;
        inBand: boolean | null;
      }>;
    }>(`/admin/v1/metrics/difficulty?${query}`);
  },
  metricsEconomy(query: string) {
    return request<{
      hintsCoins: number;
      hintsAds: number;
      coinIn: number;
      coinOut: number;
      balanceBuckets: Array<{ bucket: string; accounts: number }>;
      byReason: Array<{ reason: string; deltaSum: number }>;
    }>(`/admin/v1/metrics/economy?${query}`);
  },
  metricsAds(query: string) {
    return request<{
      rewardedOffers: number;
      rewardedStarts: number;
      rewardedCompletions: number;
      completionRate: number | null;
      rewardsGranted: number;
      rewardRatePerUser: number | null;
      interstitialImpressions: number;
      interstitialPerSession: number | null;
      arpdau: number | null;
      arpdauPending: boolean;
      iapPurchasers: number;
      iapRevenueCents: number;
      payerShare: number | null;
      medianHoursToFirstPurchase: number | null;
    }>(`/admin/v1/metrics/ads?${query}`);
  },
  metricsQuality(query: string) {
    return request<{
      accepted: number;
      duplicates: number;
      rejected: number;
      consentOptOuts: number;
      dedupeRate: number | null;
      series: Array<{
        day: string;
        accepted: number;
        duplicates: number;
        rejected: number;
        consentOptOuts: number;
      }>;
    }>(`/admin/v1/metrics/quality?${query}`);
  },
  metricsBorrowedTime(query: string) {
    return request<{
      eras: Array<{
        era: string;
        reachers: number;
        avgDebt: number | null;
        avgBuildings: number | null;
      }>;
      buildingsPlaced: number;
      avgSessionSec: number | null;
      sessions: number;
    }>(`/admin/v1/metrics/borrowed-time?${query}`);
  },
  games() {
    return request<{
      games: Array<{ id: string; name: string; draft: boolean; summary: string }>;
    }>("/admin/v1/games");
  },
  gamePlayers(gameId: string, cursor?: string) {
    const params = new URLSearchParams();
    if (cursor) params.set("cursor", cursor);
    const q = params.toString();
    return request<{
      accounts: Array<{
        id: string;
        deviceId: string;
        email: string | null;
        platform: string;
        bannedAt: string | null;
        createdAt: string;
      }>;
      nextCursor: string | null;
    }>(`/admin/v1/games/${gameId}/players${q ? `?${q}` : ""}`);
  },
  audit() {
    return request<{
      entries: Array<{
        id: string;
        action: string;
        targetType: string;
        targetId: string | null;
        createdAt: string;
      }>;
    }>("/admin/v1/audit");
  },
  staff() {
    return request<{
      staff: Array<{
        id: string;
        email: string;
        role: string;
        createdAt: string;
        disabledAt: string | null;
      }>;
    }>("/admin/v1/staff");
  },
  inviteStaff(body: { email: string; role: string }) {
    return request<{
      id: string;
      email: string;
      role: string;
      expiresAt: string;
      inviteToken: string;
    }>("/admin/v1/staff/invites", { method: "POST", body: JSON.stringify(body) });
  },
  staffInvites() {
    return request<{
      invites: Array<{
        id: string;
        email: string;
        role: string;
        expiresAt: string;
        revokedAt: string | null;
        acceptedAt: string | null;
        createdAt: string;
      }>;
    }>("/admin/v1/staff/invites");
  },
  revokeInvite(id: string) {
    return request<{ ok: true }>(`/admin/v1/staff/invites/${id}/revoke`, {
      method: "POST",
      body: "{}",
    });
  },
  ban(id: string, reason: string) {
    return request(`/admin/v1/accounts/${id}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  unban(id: string) {
    return request(`/admin/v1/accounts/${id}/unban`, { method: "POST", body: "{}" });
  },
  gameAdsSettings(gameId: string) {
    return request<{
      gameId: string;
      interstitial: {
        enabled: boolean;
        minTransitions: number;
        maxTransitions: number;
        maxPerSession: number;
        unitId: string;
      };
      rewarded: {
        enabled: boolean;
        maxPerSession: number;
        unitId: string;
      };
      houseAdsGameEnabled: boolean;
    }>(`/admin/v1/games/${gameId}/ads/settings`);
  },
  updateGameAdsSettings(
    gameId: string,
    body: {
      interstitial: {
        enabled: boolean;
        minTransitions: number;
        maxTransitions: number;
        maxPerSession: number;
        unitId: string;
      };
      rewarded: {
        enabled: boolean;
        maxPerSession: number;
        unitId: string;
      };
      houseAdsGameEnabled?: boolean;
    },
  ) {
    return request<{
      gameId: string;
      interstitial: {
        enabled: boolean;
        minTransitions: number;
        maxTransitions: number;
        maxPerSession: number;
        unitId: string;
      };
      rewarded: {
        enabled: boolean;
        maxPerSession: number;
        unitId: string;
      };
      houseAdsGameEnabled: boolean;
    }>(`/admin/v1/games/${gameId}/ads/settings`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  houseAds() {
    return request<{
      global: { enabled: boolean; killSwitch: boolean; updatedAt: string };
      games: Array<{ gameId: string; enabled: boolean }>;
      items: Array<{
        id: string;
        promotedGame: string;
        creativeRef: string;
        targetGames: string[];
        platform: "android" | "ios" | null;
        enabled: boolean;
        maxPerSession: number;
        startsAt: string | null;
        endsAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/admin/v1/ads/house");
  },
  updateHouseAdsGlobal(body: { enabled?: boolean; killSwitch?: boolean }) {
    return request<{
      global: { enabled: boolean; killSwitch: boolean; updatedAt: string };
      games: Array<{ gameId: string; enabled: boolean }>;
      items: Array<{
        id: string;
        promotedGame: string;
        creativeRef: string;
        targetGames: string[];
        platform: "android" | "ios" | null;
        enabled: boolean;
        maxPerSession: number;
        startsAt: string | null;
        endsAt: string | null;
        createdAt: string;
        updatedAt: string;
      }>;
    }>("/admin/v1/ads/house/global", {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },
  createHouseAd(body: {
    promotedGame: string;
    creativeRef: string;
    targetGames: string[];
    platform?: "android" | "ios" | null;
    enabled?: boolean;
    maxPerSession?: number;
    startsAt?: string | null;
    endsAt?: string | null;
  }) {
    return request<{
      id: string;
      promotedGame: string;
      creativeRef: string;
      targetGames: string[];
      platform: "android" | "ios" | null;
      enabled: boolean;
      maxPerSession: number;
      startsAt: string | null;
      endsAt: string | null;
      createdAt: string;
      updatedAt: string;
    }>("/admin/v1/ads/house", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
