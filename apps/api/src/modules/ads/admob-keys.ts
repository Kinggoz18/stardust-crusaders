import { createPublicKey, type KeyObject } from "node:crypto";

export const ADMOB_VERIFIER_KEYS_URL = "https://gstatic.com/admob/reward/verifier-keys.json";
export const KEY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type AdMobKeysJson = {
  keys: Array<{ keyId: number; pem?: string; base64?: string }>;
};

export type KeyFetcher = () => Promise<AdMobKeysJson>;

export class AdMobKeyCache {
  private keys = new Map<number, KeyObject>();
  private fetchedAt = 0;

  constructor(
    private readonly fetchKeys: KeyFetcher,
    private readonly ttlMs = KEY_CACHE_TTL_MS,
  ) {}

  async get(keyId: number): Promise<KeyObject | null> {
    const stale = Date.now() - this.fetchedAt > this.ttlMs;
    if (stale || this.keys.size === 0) {
      await this.refresh();
    }
    if (!this.keys.has(keyId)) {
      // One refresh on miss in case of mid-rotation.
      await this.refresh();
    }
    return this.keys.get(keyId) ?? null;
  }

  /** Test helper: replace cache contents without network. */
  replace(keys: Map<number, KeyObject>) {
    this.keys = keys;
    this.fetchedAt = Date.now();
  }

  clear() {
    this.keys.clear();
    this.fetchedAt = 0;
  }

  private async refresh() {
    const json = await this.fetchKeys();
    const next = new Map<number, KeyObject>();
    for (const entry of json.keys ?? []) {
      const pem =
        entry.pem ??
        (entry.base64
          ? `-----BEGIN PUBLIC KEY-----\n${entry.base64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`
          : null);
      if (!pem) continue;
      next.set(entry.keyId, createPublicKey(pem));
    }
    this.keys = next;
    this.fetchedAt = Date.now();
  }
}

export async function fetchAdMobKeysFromUrl(url: string): Promise<AdMobKeysJson> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`AdMob key fetch failed with status ${res.status}`);
  }
  return (await res.json()) as AdMobKeysJson;
}
