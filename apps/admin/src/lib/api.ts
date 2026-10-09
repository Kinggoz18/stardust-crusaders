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
      retention: { d1: number | null; d7: number | null };
    }>("/admin/v1/metrics");
  },
  games() {
    return request<{
      games: Array<{ id: string; name: string; draft: boolean; summary: string }>;
    }>("/admin/v1/games");
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
};
