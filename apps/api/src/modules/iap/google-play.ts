import { createSign } from "node:crypto";

/**
 * Google Play one-time purchase verification through the Play Developer API
 * (purchases.productsv2.getproductpurchasev2) and acknowledgement
 * (purchases.products.acknowledge). Auth is a service account JWT exchanged
 * for an OAuth token with the androidpublisher scope.
 */

export type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

export type GooglePlayOptions = {
  serviceAccount: ServiceAccount;
  /** gameId -> Android package name */
  packages: Record<string, string>;
  apiBase?: string;
  tokenUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
};

export type PlayPurchase = {
  orderId?: string;
  purchaseState: "PURCHASED" | "CANCELLED" | "PENDING" | "UNKNOWN";
  acknowledged: boolean;
  test: boolean;
  productIds: string[];
  accountRef?: string;
};

const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

export function parsePackages(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const [game, pkg] = pair.split(":").map((s) => s?.trim());
    if (game && pkg) out[game] = pkg;
  }
  return out;
}

/** Accepts raw JSON or base64 JSON (handier in .env files). */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw) return null;
  const text = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  const sa = JSON.parse(text) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("Service account JSON is missing fields.");
  return sa;
}

export class GooglePlayVerifier {
  private token: { value: string; exp: number } | null = null;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private readonly apiBase: string;

  constructor(private readonly opts: GooglePlayOptions) {
    this.fetch = opts.fetchImpl ?? fetch;
    this.now = opts.now ?? Date.now;
    this.apiBase = opts.apiBase ?? "https://androidpublisher.googleapis.com";
  }

  packageFor(gameId: string): string | undefined {
    return this.opts.packages[gameId];
  }

  private async accessToken(): Promise<string> {
    const nowS = Math.floor(this.now() / 1000);
    if (this.token && this.token.exp - 60 > nowS) return this.token.value;
    const sa = this.opts.serviceAccount;
    const aud = this.opts.tokenUrl ?? sa.token_uri ?? "https://oauth2.googleapis.com/token";
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = b64url(
      JSON.stringify({ iss: sa.client_email, scope: SCOPE, aud, iat: nowS, exp: nowS + 3600 }),
    );
    const signer = createSign("RSA-SHA256");
    signer.update(`${header}.${claims}`);
    const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
    const res = await this.fetch(aud, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }).toString(),
    });
    if (!res.ok) throw new Error(`Google token exchange failed (${res.status}).`);
    const body = (await res.json()) as { access_token: string; expires_in?: number };
    this.token = { value: body.access_token, exp: nowS + (body.expires_in ?? 3600) };
    return body.access_token;
  }

  async getPurchase(packageName: string, purchaseToken: string): Promise<PlayPurchase | null> {
    const url = `${this.apiBase}/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/productsv2/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await this.fetch(url, {
      headers: { authorization: `Bearer ${await this.accessToken()}` },
    });
    if (res.status === 404 || res.status === 400 || res.status === 410) return null;
    if (!res.ok) throw new Error(`Play Developer API error (${res.status}).`);
    const p = (await res.json()) as {
      orderId?: string;
      obfuscatedExternalAccountId?: string;
      acknowledgementState?: string;
      testPurchaseContext?: unknown;
      purchaseStateContext?: { purchaseState?: string };
      productLineItem?: { productId?: string }[];
    };
    const state = p.purchaseStateContext?.purchaseState;
    return {
      orderId: p.orderId,
      purchaseState:
        state === "PURCHASED" || state === "CANCELLED" || state === "PENDING" ? state : "UNKNOWN",
      acknowledged: p.acknowledgementState === "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
      test: p.testPurchaseContext != null,
      productIds: (p.productLineItem ?? []).map((l) => l.productId ?? "").filter(Boolean),
      accountRef: p.obfuscatedExternalAccountId,
    };
  }

  async acknowledge(packageName: string, productId: string, purchaseToken: string) {
    const url = `${this.apiBase}/androidpublisher/v3/applications/${encodeURIComponent(
      packageName,
    )}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(
      purchaseToken,
    )}:acknowledge`;
    const res = await this.fetch(url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (!res.ok) throw new Error(`Acknowledge failed (${res.status}).`);
  }
}
