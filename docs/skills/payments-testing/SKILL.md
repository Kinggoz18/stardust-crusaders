---
name: payments-testing
description: Prove payment flows work without real money. Use for any change touching checkout, charges, refunds, subscriptions, payouts, or payment webhooks (Stripe or Paystack). Covers test keys only, webhook signature checks, replaying the same webhook twice for idempotency, server-side amount checks, integer kobo, fail-closed handling, and test clocks.
---

# Payments testing

Owner: Anvil. Reviewer: Warden (threat model before work starts). AGENTS.md declares
`payments: none | sandbox | live` and the provider.

## Hard lines
- **Test keys only** (`sk_test_...`, restricted keys where possible), from the secret store by name.
  Live-key charges, refunds, and transfers are blocked unless Chigozie explicitly asks, and a live
  smoke test (small charge plus refund) is always his checklist, never a bot action.
- Never log card data, full webhook bodies with personal data, or secret values.

## What every payment change must prove
1. **Signature verification** on every webhook, rejecting bad signatures with a 4xx:
   Stripe `Stripe-Signature` via the SDK's `constructEvent` (5-minute tolerance);
   Paystack `x-paystack-signature` = HMAC SHA-512 of the raw body with the secret key.
   Test: a tampered body is rejected.
2. **Idempotency**: deliver the **same** webhook twice; exactly one side effect (one order marked
   paid, one email, one ledger row). Key on the provider's event or transaction ID with a unique
   constraint, not on "check then insert".
3. **Server-side amounts**: the server recomputes the amount from its own prices; a client-sent
   amount is ignored. Test: a tampered amount in the request fails or is corrected.
4. **Fail closed**: if verification with the provider errors or times out, the order stays unpaid.
   (OWASP A10:2025.)
5. **Money as integers**: kobo (NGN x 100) and cents, never floats. Display with
   `Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })`.

## Stripe
- `stripe listen --forward-to localhost:<port>/<webhook path>` (test mode by default), then
  `stripe trigger payment_intent.succeeded`.
- Replay for idempotency: `stripe events resend <evt_id>` (add `--webhook-endpoint=<we_id>` for a
  registered endpoint; events up to 30 days old). Resends carry a new signature and timestamp.
- Subscriptions and trials: create a **test clock**, attach the customer, and advance it through
  renewal, failed payment, and cancellation (Dashboard, API `test_helpers/test_clocks`, or
  `stripe test_helpers test_clocks create --frozen-time <unix>`).
- Cards: `4242 4242 4242 4242` succeeds; use Stripe's documented decline and 3DS cards for failures.

## Paystack
- Test cards (docs: paystack.com/docs/payments/test-payments): `4084 0840 8408 4081`, CVV 408, any
  future expiry, succeeds without validation; `5060 6666 6666 6666 666`, CVV 123, PIN 1234,
  OTP 123456 exercises PIN plus OTP; the docs also list failing cards. Bank-issued cards are declined in test mode.
- Verify every transaction server-side with `GET /transaction/verify/:reference` before fulfilling.
- Replay: capture one real test-mode webhook body and header into a fixture and POST it twice to the
  local endpoint; also POST it once with a changed body to prove the signature check.

## Evidence
Into `.artifacts/<run-id>/`: the webhook request and response log (secrets redacted), DB rows before
and after both deliveries, the test-clock timeline, and the e2e trace of the checkout path. If a
step cannot be verified (real cards, a provider outage), label the PR "needs human verification"
and add a manual checklist with exact steps and expected results.

## pstack
Builds on `principle-make-operations-idempotent`, `principle-boundary-discipline` (parse webhooks at
the edge), `tdd` (a failing replay test first), `blast-radius` for small risky diffs, and
`principle-prove-it-works`.
