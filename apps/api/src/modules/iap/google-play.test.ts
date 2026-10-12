import { describe, expect, test } from "bun:test";
import { generateKeyPairSync } from "node:crypto";
import { GooglePlayVerifier, parsePackages, parseServiceAccount } from "./google-play.js";
import { GooglePlayIapService } from "./google-service.js";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = { client_email: "bot@test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

function fakeGoogle(purchase: Record<string, unknown> | null) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push(`${init?.method ?? "GET"} ${url}`);
    if (url === "https://oauth.test/token") {
      const form = new URLSearchParams(String(init?.body));
      expect(form.get("assertion")?.split(".").length).toBe(3);
      return Response.json({ access_token: "tok", expires_in: 3600 });
    }
    if (url.endsWith(":acknowledge")) return new Response("{}");
    return purchase ? Response.json(purchase) : new Response("{}", { status: 404 });
  }) as unknown as typeof fetch;
  const verifier = new GooglePlayVerifier({
    serviceAccount: sa,
    packages: parsePackages("one-spark:com.stardust.onespark"),
    tokenUrl: "https://oauth.test/token",
    apiBase: "https://play.test",
    fetchImpl,
  });
  return { verifier, calls };
}

const body = (id = "os_no_ads") => ({
  id,
  transaction: { type: "android-playstore", purchaseToken: "token-abcdefghijk" },
});
const bought = (extra: Record<string, unknown> = {}) => ({
  orderId: "GPA.1",
  purchaseStateContext: { purchaseState: "PURCHASED" },
  acknowledgementState: "ACKNOWLEDGEMENT_STATE_PENDING",
  testPurchaseContext: {},
  productLineItem: [{ productId: "os_no_ads" }],
  ...extra,
});

describe("Google Play purchase checks", () => {
  test("parses packages and base64 service accounts", () => {
    expect(parsePackages("a:x.y, b:z.w")).toEqual({ a: "x.y", b: "z.w" });
    const b64 = Buffer.from(JSON.stringify(sa)).toString("base64");
    expect(parseServiceAccount(b64)?.client_email).toBe(sa.client_email);
  });

  test("accepts a test purchase and acknowledges it", async () => {
    const { verifier, calls } = fakeGoogle(bought());
    const v = await new GooglePlayIapService(null, verifier, "sandbox").validate("one-spark", body());
    expect(v.ok).toBe(true);
    expect(calls.some((c) => c.includes("/purchases/productsv2/tokens/token-abcdefghijk"))).toBe(true);
    expect(calls.some((c) => c.startsWith("POST") && c.endsWith(":acknowledge"))).toBe(true);
  });

  test("sandbox mode refuses real-money purchases", async () => {
    const { verifier } = fakeGoogle(bought({ testPurchaseContext: undefined }));
    const v = await new GooglePlayIapService(null, verifier, "sandbox").validate("one-spark", body());
    expect(v.ok).toBe(false);
    const live = await new GooglePlayIapService(null, verifier, "live").validate("one-spark", body());
    expect(live.ok).toBe(true);
  });

  test("rejects unknown, pending, wrong item and wrong player", async () => {
    const svc = (p: Record<string, unknown> | null) => new GooglePlayIapService(null, fakeGoogle(p).verifier, "live");
    expect((await svc(null).validate("one-spark", body())).ok).toBe(false);
    const pending = await svc(bought({ purchaseStateContext: { purchaseState: "PENDING" } })).validate("one-spark", body());
    expect(pending.ok === false && pending.code).toBe(6778004);
    expect((await svc(bought()).validate("one-spark", body("other"))).ok).toBe(false);
    expect((await svc(bought()).validate("loom-rush", body())).ok).toBe(false);
    const theirs = await svc(bought({ obfuscatedExternalAccountId: "acc-1" })).validate("one-spark", {
      ...body(), additionalData: { applicationUsername: "acc-2" },
    });
    expect(theirs.ok).toBe(false);
  });

  test("off mode never calls Google", async () => {
    const { verifier, calls } = fakeGoogle(bought());
    const v = await new GooglePlayIapService(null, verifier, "off").validate("one-spark", body());
    expect(v.ok).toBe(false);
    expect(calls.length).toBe(0);
  });
});
