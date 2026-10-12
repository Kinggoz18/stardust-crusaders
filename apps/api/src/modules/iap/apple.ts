import { createPrivateKey, randomUUID, sign as signRaw, verify as verifyRaw, X509Certificate } from "node:crypto";
import { APPLE_ROOT_G3_PEM } from "./apple-root.js";

/**
 * App Store (StoreKit 2) verification.
 * - Signed JWS transactions and Server Notifications V2 are checked offline: the x5c chain must
 *   end at Apple Root CA - G3 (pinned), carry Apple's leaf/intermediate marker OIDs, and the ES256
 *   signature must match the leaf key.
 * - When an App Store Server API key is configured, the transaction is also fetched from
 *   GET /inApps/v1/transactions/{transactionId} so a revoked or forged id is caught.
 */

export { APPLE_ROOT_G3_PEM };

const LEAF_OID = Buffer.from("060a2a864886f76364060b01", "hex"); // 1.2.840.113635.100.6.11.1
const INTERMEDIATE_OID = Buffer.from("060a2a864886f763640602 01".replace(/ /g, ""), "hex"); // 1.2.840.113635.100.6.2.1

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const unb64url = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export class JwsError extends Error {}

/** Verify an Apple-signed JWS and return its payload. `roots` are trusted root PEMs. */
export function verifyAppleJws<T = Record<string, unknown>>(
  jws: string,
  roots: string[] = [APPLE_ROOT_G3_PEM],
  at: Date = new Date(),
): T {
  const parts = jws.split(".");
  if (parts.length !== 3) throw new JwsError("Not a JWS.");
  const header = JSON.parse(unb64url(parts[0]).toString("utf8")) as { alg?: string; x5c?: string[] };
  if (header.alg !== "ES256") throw new JwsError("Unexpected algorithm.");
  const chain = header.x5c ?? [];
  if (chain.length < 3) throw new JwsError("Certificate chain is incomplete.");
  const [leaf, inter, root] = chain.slice(0, 3).map((c) => new X509Certificate(Buffer.from(c, "base64")));
  const trusted = roots.map((r) => new X509Certificate(r));
  if (!trusted.some((t) => t.fingerprint256 === root.fingerprint256)) throw new JwsError("Untrusted root.");
  if (!leaf.verify(inter.publicKey) || !inter.verify(root.publicKey)) throw new JwsError("Broken chain.");
  for (const c of [leaf, inter]) {
    if (at < new Date(c.validFrom) || at > new Date(c.validTo)) throw new JwsError("Certificate expired.");
  }
  if (!leaf.raw.includes(LEAF_OID) || !inter.raw.includes(INTERMEDIATE_OID)) {
    throw new JwsError("Not an App Store certificate.");
  }
  const ok = verifyRaw(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key: leaf.publicKey, dsaEncoding: "ieee-p1363" },
    unb64url(parts[2]),
  );
  if (!ok) throw new JwsError("Bad signature.");
  return JSON.parse(unb64url(parts[1]).toString("utf8")) as T;
}

/** Test helper: sign a payload like Apple does, with a supplied chain and leaf key. */
export function signTestJws(payload: unknown, chainPem: string[], leafKeyPem: string): string {
  const x5c = chainPem.map((p) => new X509Certificate(p).raw.toString("base64"));
  const head = b64url(JSON.stringify({ alg: "ES256", x5c }));
  const body = b64url(JSON.stringify(payload));
  const sig = signRaw("sha256", Buffer.from(`${head}.${body}`), { key: leafKeyPem, dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${b64url(sig)}`;
}

export type AppleTransaction = {
  transactionId: string;
  originalTransactionId?: string;
  bundleId: string;
  productId: string;
  environment: "Sandbox" | "Production" | "Xcode" | "LocalTesting" | string;
  type?: string;
  appAccountToken?: string;
  revocationDate?: number;
  purchaseDate?: number;
};

export type AppStoreApiKey = { issuerId: string; keyId: string; privateKey: string };

export class AppStoreServerApi {
  private readonly fetch: typeof fetch;

  constructor(
    private readonly key: AppStoreApiKey,
    private readonly opts: { fetchImpl?: typeof fetch; baseUrl?: (sandbox: boolean) => string } = {},
  ) {
    this.fetch = opts.fetchImpl ?? fetch;
  }

  /** ES256 bearer token for the App Store Server API (max 60 min; we use 5). */
  token(bundleId: string, now = Date.now()): string {
    const iat = Math.floor(now / 1000);
    const head = b64url(JSON.stringify({ alg: "ES256", kid: this.key.keyId, typ: "JWT" }));
    const body = b64url(
      JSON.stringify({ iss: this.key.issuerId, iat, exp: iat + 300, aud: "appstoreconnect-v1", bid: bundleId, nonce: randomUUID() }),
    );
    const sig = signRaw("sha256", Buffer.from(`${head}.${body}`), {
      key: createPrivateKey(this.key.privateKey),
      dsaEncoding: "ieee-p1363",
    });
    return `${head}.${body}.${b64url(sig)}`;
  }

  /** Returns the signedTransactionInfo JWS, or null when Apple does not know the id. */
  async getTransaction(bundleId: string, transactionId: string, sandbox: boolean): Promise<string | null> {
    const base =
      this.opts.baseUrl?.(sandbox) ??
      (sandbox ? "https://api.storekit-sandbox.itunes.apple.com" : "https://api.storekit.itunes.apple.com");
    const res = await this.fetch(`${base}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { authorization: `Bearer ${this.token(bundleId)}` },
    });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`App Store Server API error (${res.status}).`);
    return ((await res.json()) as { signedTransactionInfo?: string }).signedTransactionInfo ?? null;
  }
}

/** "a:b" pairs, same format as GOOGLE_PLAY_PACKAGES. */
export function parsePairs(raw: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of (raw ?? "").split(",")) {
    const [k, v] = pair.split(":").map((s) => s?.trim());
    if (k && v) out[k] = v;
  }
  return out;
}

/** .p8 contents, raw PEM, base64 PEM, or with literal \n escapes. */
export function parsePrivateKey(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return s.replace(/\\n/g, "\n");
}
