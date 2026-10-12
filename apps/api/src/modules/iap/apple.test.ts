import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { AppStoreServerApi, signTestJws, verifyAppleJws } from "./apple.js";
import { AppleIapService } from "./apple-service.js";

// Test-only chain (fixtures/): a fake root/intermediate/leaf with Apple's marker OIDs.
const fx = (f: string) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");
const root = fx("root.pem");
const chain = [fx("leaf.pem"), fx("int.pem"), root];
const leafKey = fx("leaf.p8");
const sign = (p: unknown) => signTestJws(p, chain, leafKey);

const tx = (extra: Record<string, unknown> = {}) => ({
  transactionId: "2000000111",
  originalTransactionId: "2000000111",
  bundleId: "com.stardust.onespark",
  productId: "remove_ads",
  environment: "Sandbox",
  type: "Non-Consumable",
  ...extra,
});
const body = (jws: string, id = "remove_ads", who?: string) => ({
  id,
  transaction: { type: "apple-sk2", jwsRepresentation: jws },
  ...(who ? { additionalData: { applicationUsername: who } } : {}),
});
const svc = (mode: "off" | "sandbox" | "live" = "sandbox", api: AppStoreServerApi | null = null) =>
  new AppleIapService({ db: null, mode, bundles: { "one-spark": "com.stardust.onespark" }, roots: [root], api });

describe("Apple JWS", () => {
  test("verifies a signed payload against the trusted root", () => {
    expect(verifyAppleJws<{ productId: string }>(sign(tx()), [root]).productId).toBe("remove_ads");
  });
  test("rejects a tampered payload", () => {
    const [h, , s] = sign(tx()).split(".");
    const forged = Buffer.from(JSON.stringify(tx({ productId: "gems" }))).toString("base64url");
    expect(() => verifyAppleJws(`${h}.${forged}.${s}`, [root])).toThrow();
  });
  test("the pinned Apple root refuses a self-made chain", () => {
    expect(() => verifyAppleJws(sign(tx()))).toThrow("Untrusted root.");
  });
});

describe("App Store purchase checks", () => {
  test("accepts a sandbox purchase in sandbox mode", async () => {
    const v = await svc().validate("one-spark", body(sign(tx())));
    expect(v.ok).toBe(true);
  });
  test("refuses production purchases in sandbox mode, accepts them live", async () => {
    const jws = sign(tx({ environment: "Production" }));
    expect((await svc("sandbox").validate("one-spark", body(jws))).ok).toBe(false);
    expect((await svc("live").validate("one-spark", body(jws))).ok).toBe(true);
  });
  test("rejects wrong app, wrong item, refunds, other player and off mode", async () => {
    expect((await svc().validate("one-spark", body(sign(tx({ bundleId: "x.y" }))))).ok).toBe(false);
    expect((await svc().validate("one-spark", body(sign(tx()), "coins")))).toMatchObject({ ok: false });
    expect((await svc().validate("one-spark", body(sign(tx({ revocationDate: 1 }))))).ok).toBe(false);
    const theirs = body(sign(tx({ appAccountToken: "aaaaaaaa-0000-4000-8000-000000000001" })), "remove_ads", "aaaaaaaa-0000-4000-8000-000000000002");
    expect((await svc().validate("one-spark", theirs)).ok).toBe(false);
    expect((await svc("off").validate("one-spark", body(sign(tx())))).ok).toBe(false);
    expect((await svc().validate("loom-rush", body(sign(tx())))).ok).toBe(false);
  });
  test("cross-checks with the App Store Server API when a key is set", async () => {
    const seen: string[] = [];
    const mk = (fresh: string | null) =>
      new AppStoreServerApi(
        { issuerId: "iss", keyId: "KEY123", privateKey: leafKey },
        {
          baseUrl: (sb) => (sb ? "https://sandbox.test" : "https://prod.test"),
          fetchImpl: (async (url: string, init?: RequestInit) => {
            seen.push(`${url} ${(init?.headers as Record<string, string>).authorization.split(".").length}`);
            return fresh ? Response.json({ signedTransactionInfo: fresh }) : new Response("{}", { status: 404 });
          }) as unknown as typeof fetch,
        },
      );
    expect((await svc("sandbox", mk(sign(tx()))).validate("one-spark", body(sign(tx())))).ok).toBe(true);
    expect(seen[0]).toBe("https://sandbox.test/inApps/v1/transactions/2000000111 3");
    expect((await svc("sandbox", mk(sign(tx({ revocationDate: 5 })))).validate("one-spark", body(sign(tx())))).ok).toBe(false);
    expect((await svc("sandbox", mk(null)).validate("one-spark", body(sign(tx())))).ok).toBe(false);
  });
  test("signs App Store Server API tokens with the right claims", () => {
    const t = new AppStoreServerApi({ issuerId: "iss", keyId: "KEY123", privateKey: leafKey }).token("com.stardust.onespark", 1_000_000);
    const [h, p] = t.split(".").slice(0, 2).map((x) => JSON.parse(Buffer.from(x, "base64url").toString()) as Record<string, unknown>);
    expect(h).toMatchObject({ alg: "ES256", kid: "KEY123" });
    expect(p).toMatchObject({ iss: "iss", aud: "appstoreconnect-v1", bid: "com.stardust.onespark", iat: 1000, exp: 1300 });
  });
});

describe("App Store Server Notifications V2", () => {
  const note = (extra: Record<string, unknown> = {}) => ({
    notificationType: "REFUND",
    notificationUUID: "11111111-2222-4333-8444-555555555555",
    data: { bundleId: "com.stardust.onespark", environment: "Sandbox", signedTransactionInfo: sign(tx({ revocationDate: 9 })) },
    ...extra,
  });
  test("accepts a signed notification", async () => {
    expect(await svc().handleNotification({ signedPayload: sign(note()) })).toMatchObject({ ok: true, type: "REFUND" });
  });
  test("rejects unsigned or foreign notifications", async () => {
    await expect(svc().handleNotification({ signedPayload: "a.b.c" })).rejects.toThrow();
    await expect(svc().handleNotification({ signedPayload: sign(note({ data: { bundleId: "x" } })) })).rejects.toThrow("unknown app");
    await expect(svc().handleNotification({})).rejects.toThrow();
  });
});
