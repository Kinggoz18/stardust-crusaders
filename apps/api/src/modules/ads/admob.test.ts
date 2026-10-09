import { describe, expect, test } from "bun:test";
import { createSign, generateKeyPairSync } from "node:crypto";
import { AdMobProvider, createTestAdMobSigner } from "./provider.js";
import { AdMobKeyCache } from "./admob-keys.js";

describe("AdMob SSV verifier", () => {
  test("accepts a valid signed callback", async () => {
    const { cache, signQuery } = createTestAdMobSigner(99);
    const provider = new AdMobProvider({ keyCache: cache });
    const accountId = "11111111-1111-1111-1111-111111111111";
    const custom = encodeURIComponent(
      JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
    );
    const now = Date.now();
    const q = signQuery({
      ad_network: "5450213213286189855",
      ad_unit: "123",
      custom_data: custom,
      reward_amount: "5",
      reward_item: "coins",
      timestamp: String(now),
      transaction_id: "abc123deadbeef",
      user_id: accountId,
    });
    const parsed = await provider.verifySsvQuery(q);
    expect(parsed?.transactionId).toBe("abc123deadbeef");
    expect(parsed?.accountId).toBe(accountId);
    expect(parsed?.reward.amount).toBe(5);
  });

  test("rejects tampered content", async () => {
    const { cache, signQuery } = createTestAdMobSigner(99);
    const provider = new AdMobProvider({ keyCache: cache });
    const accountId = "11111111-1111-1111-1111-111111111111";
    const custom = encodeURIComponent(
      JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
    );
    const q = signQuery({
      ad_network: "1",
      ad_unit: "1",
      custom_data: custom,
      reward_amount: "5",
      reward_item: "coins",
      timestamp: String(Date.now()),
      transaction_id: "txn-tamper",
      user_id: accountId,
    });
    const tampered = q.replace("reward_amount=5", "reward_amount=50");
    expect(await provider.verifySsvQuery(tampered)).toBeNull();
  });

  test("rejects unknown / expired key id", async () => {
    const { privateKey, signQuery } = createTestAdMobSigner(1);
    // Cache only has a different key.
    const other = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const cache = new AdMobKeyCache(async () => ({
      keys: [
        {
          keyId: 2,
          pem: other.publicKey.export({ type: "spki", format: "pem" }).toString(),
        },
      ],
    }));
    cache.replace(new Map([[2, other.publicKey]]));
    const provider = new AdMobProvider({ keyCache: cache });
    const accountId = "11111111-1111-1111-1111-111111111111";
    const custom = encodeURIComponent(
      JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
    );
    // Signed with key 1, but cache only has key 2.
    const content = [
      `ad_network=1`,
      `ad_unit=1`,
      `custom_data=${custom}`,
      `reward_amount=5`,
      `reward_item=coins`,
      `timestamp=${Date.now()}`,
      `transaction_id=txn-expired-key`,
      `user_id=${accountId}`,
    ].join("&");
    const signer = createSign("SHA256");
    signer.update(content);
    signer.end();
    const sig = signer.sign(privateKey).toString("base64url");
    const q = `${content}&signature=${sig}&key_id=1`;
    expect(await provider.verifySsvQuery(q)).toBeNull();
  });

  test("rejects stale timestamp", async () => {
    const { cache, signQuery } = createTestAdMobSigner(7);
    const provider = new AdMobProvider({
      keyCache: cache,
      maxAgeMs: 60_000,
      now: () => 1_700_000_000_000,
    });
    const accountId = "11111111-1111-1111-1111-111111111111";
    const custom = encodeURIComponent(
      JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
    );
    const q = signQuery({
      ad_network: "1",
      ad_unit: "1",
      custom_data: custom,
      reward_amount: "5",
      reward_item: "coins",
      timestamp: String(1_700_000_000_000 - 120_000),
      transaction_id: "txn-stale",
      user_id: accountId,
    });
    expect(await provider.verifySsvQuery(q)).toBeNull();
  });

  test("rejects user_id that does not match custom_data account", async () => {
    const { cache, signQuery } = createTestAdMobSigner(3);
    const provider = new AdMobProvider({ keyCache: cache });
    const accountId = "11111111-1111-1111-1111-111111111111";
    const other = "22222222-2222-2222-2222-222222222222";
    const custom = encodeURIComponent(
      JSON.stringify({ accountId, gameId: "one-spark", rewardKind: "coins" }),
    );
    const q = signQuery({
      ad_network: "1",
      ad_unit: "1",
      custom_data: custom,
      reward_amount: "5",
      reward_item: "coins",
      timestamp: String(Date.now()),
      transaction_id: "txn-wrong-user",
      user_id: other,
    });
    expect(await provider.verifySsvQuery(q)).toBeNull();
  });
});
