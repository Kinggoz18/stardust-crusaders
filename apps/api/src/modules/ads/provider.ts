import { createHmac, timingSafeEqual } from "node:crypto";
import type { AdRewardCallback } from "@stardust/schema";

export interface AdProvider {
  name: string;
  verifyRewardCallback(payload: AdRewardCallback, rawBody: string): boolean;
}

export class NoneAdProvider implements AdProvider {
  name = "none";
  verifyRewardCallback(): boolean {
    return false;
  }
}

/** Provider-agnostic HMAC verifier used until a network is chosen. */
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

export function createAdProvider(name: string, secret: string): AdProvider {
  if (name === "generic") return new GenericAdProvider(secret);
  return new NoneAdProvider();
}

export function signGenericReward(
  secret: string,
  payload: Omit<AdRewardCallback, "signature">,
): string {
  const basis = `${payload.transactionId}.${payload.accountId}.${payload.reward.kind}.${payload.reward.amount}.${payload.signedAt}`;
  return createHmac("sha256", secret).update(basis).digest("hex");
}
