import {
  createHmac,
  createSign,
  createVerify,
  generateKeyPairSync,
  timingSafeEqual,
  type KeyObject,
} from "node:crypto";
import {
  admobCustomDataSchema,
  adRewardCallbackSchema,
  adRewardKindSchema,
  type AdRewardCallback,
} from "@stardust/schema";
import {
  ADMOB_VERIFIER_KEYS_URL,
  AdMobKeyCache,
  fetchAdMobKeysFromUrl,
  type AdMobKeysJson,
  type KeyFetcher,
} from "./admob-keys.js";

export interface AdProvider {
  name: string;
  verifyRewardCallback(payload: AdRewardCallback, rawBody: string): boolean | Promise<boolean>;
  /** AdMob SSV GET query → normalised reward callback, or null if invalid. */
  verifySsvQuery?(queryString: string): Promise<AdRewardCallback | null>;
}

export class NoneAdProvider implements AdProvider {
  name = "none";
  verifyRewardCallback(): boolean {
    return false;
  }
}

/** Provider-agnostic HMAC verifier used in tests and as a fallback. */
export class GenericAdProvider implements AdProvider {
  name = "generic";
  constructor(private readonly secret: string) {}

  verifyRewardCallback(payload: AdRewardCallback, _rawBody: string): boolean {
    const basis = `${payload.transactionId}.${payload.accountId}.${payload.reward.kind}.${payload.reward.amount}.${payload.signedAt}`;
    const expected = createHmac("sha256", this.secret).update(basis).digest("hex");
    const got = payload.signature;
    try {
      const a = Buffer.from(expected);
      const b = Buffer.from(got);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }
}

export type AdMobProviderOptions = {
  keyCache: AdMobKeyCache;
  /** Reject callbacks older than this (ms). Default 1 hour. */
  maxAgeMs?: number;
  now?: () => number;
};

/**
 * AdMob rewarded SSV: ECDSA P-256 + SHA-256 over the query string before &signature=.
 * custom_data JSON maps account + game + reward kind; user_id must match accountId.
 */
export class AdMobProvider implements AdProvider {
  name = "admob";
  private readonly maxAgeMs: number;
  private readonly now: () => number;

  constructor(private readonly options: AdMobProviderOptions) {
    this.maxAgeMs = options.maxAgeMs ?? 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
  }

  verifyRewardCallback(): boolean {
    // AdMob delivers GET SSV, not the generic JSON POST body.
    return false;
  }

  async verifySsvQuery(queryString: string): Promise<AdRewardCallback | null> {
    const raw = queryString.startsWith("?") ? queryString.slice(1) : queryString;
    const sigMarker = "&signature=";
    const sigIdx = raw.indexOf(sigMarker);
    if (sigIdx <= 0) return null;
    const content = raw.slice(0, sigIdx);
    const rest = raw.slice(sigIdx + 1); // signature=...&key_id=...
    const keyMarker = "&key_id=";
    const keyIdx = rest.indexOf(keyMarker);
    if (keyIdx <= 0) return null;
    const signatureB64 = rest.slice("signature=".length, keyIdx);
    const keyIdStr = rest.slice(keyIdx + keyMarker.length);
    const keyId = Number(keyIdStr);
    if (!Number.isFinite(keyId)) return null;

    let signature: Buffer;
    try {
      signature = Buffer.from(signatureB64, "base64url");
    } catch {
      return null;
    }

    const publicKey = await this.options.keyCache.get(keyId);
    if (!publicKey) return null;

    const verifier = createVerify("SHA256");
    verifier.update(content);
    verifier.end();
    let ok = false;
    try {
      ok = verifier.verify(publicKey, signature);
    } catch {
      return null;
    }
    if (!ok) return null;

    const params = new URLSearchParams(content);
    const transactionId = params.get("transaction_id");
    const timestampStr = params.get("timestamp");
    const userId = params.get("user_id");
    const customRaw = params.get("custom_data");
    const rewardAmountStr = params.get("reward_amount");
    const rewardItem = params.get("reward_item");
    if (!transactionId || !timestampStr || !userId || !customRaw || !rewardAmountStr) {
      return null;
    }

    const timestampMs = Number(timestampStr);
    if (!Number.isFinite(timestampMs)) return null;
    if (Math.abs(this.now() - timestampMs) > this.maxAgeMs) return null;

    let customJson: unknown;
    try {
      customJson = JSON.parse(customRaw);
    } catch {
      try {
        customJson = JSON.parse(decodeURIComponent(customRaw));
      } catch {
        return null;
      }
    }
    const custom = admobCustomDataSchema.safeParse(customJson);
    if (!custom.success) return null;
    if (custom.data.accountId !== userId) return null;

    const amount = Number(rewardAmountStr);
    if (!Number.isInteger(amount) || amount <= 0) return null;

    const kindFromItem = adRewardKindSchema.safeParse(rewardItem);
    const kind = kindFromItem.success ? kindFromItem.data : custom.data.rewardKind;

    const signedAt = new Date(timestampMs).toISOString();
    const payload = adRewardCallbackSchema.safeParse({
      transactionId,
      accountId: custom.data.accountId,
      gameId: custom.data.gameId,
      reward: { kind, amount },
      signature: signatureB64,
      signedAt,
    });
    return payload.success ? payload.data : null;
  }
}

export type CreateAdProviderOptions = {
  signingSecret: string;
  keysUrl?: string;
  maxAgeMs?: number;
  fetchKeys?: KeyFetcher;
  keyCache?: AdMobKeyCache;
};

export function createAdProvider(name: string, options: CreateAdProviderOptions): AdProvider {
  if (name === "generic") return new GenericAdProvider(options.signingSecret);
  if (name === "admob") {
    const fetchKeys =
      options.fetchKeys ??
      (() => fetchAdMobKeysFromUrl(options.keysUrl ?? ADMOB_VERIFIER_KEYS_URL));
    const keyCache = options.keyCache ?? new AdMobKeyCache(fetchKeys);
    return new AdMobProvider({ keyCache, maxAgeMs: options.maxAgeMs });
  }
  return new NoneAdProvider();
}

export function signGenericReward(
  secret: string,
  payload: Omit<AdRewardCallback, "signature">,
): string {
  const basis = `${payload.transactionId}.${payload.accountId}.${payload.reward.kind}.${payload.reward.amount}.${payload.signedAt}`;
  return createHmac("sha256", secret).update(basis).digest("hex");
}

/** Test helper: EC P-256 keypair + sign AdMob-style query content. */
export function createTestAdMobSigner(keyId = 424242) {
  const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
  const pem = publicKey.export({ type: "spki", format: "pem" }).toString();
  let published: AdMobKeysJson = { keys: [{ keyId, pem }] };
  const cache = new AdMobKeyCache(async () => published);
  cache.replace(new Map<number, KeyObject>([[keyId, publicKey]]));

  function signQuery(params: Record<string, string>): string {
    const ordered = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    const signer = createSign("SHA256");
    signer.update(ordered);
    signer.end();
    const sig = signer.sign(privateKey).toString("base64url");
    return `${ordered}&signature=${sig}&key_id=${keyId}`;
  }

  function publishKeys(keys: AdMobKeysJson["keys"]) {
    published = { keys };
    cache.clear();
  }

  return { keyId, publicKey, privateKey, pem, cache, signQuery, publishKeys };
}
