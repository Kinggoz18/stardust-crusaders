# Roadmap (design only — not built in this foundation)

## Near-term product

- Cloud save linking UX (Apple / Google / email) with merge rules from ARCHITECTURE DR3
- Push notifications (session reminders, daily reward)
- A/B config + shared remote-flags service
- Ad mediation / waterfall on top of AdMob (AppLovin MAX still optional later); keep `AdProvider` boundary
- Harden farming controls (device attestation / Play Integrity) once volume warrants it

## Borrowed Time async multiplayer (FINAL_PLAN §12)

Do **not** build now. When retention justifies it:

1. Server tick (minutes) advancing shared world day
2. Authoritative replay of client **command log** with seeded RNG (`resolveRaid`, season rules)
3. Alliances, trading board matched at tick
4. Raiding other players from last `IslandSnapshot`; shield after raid
5. Data shapes already reserved: `IslandSnapshot`, append-only event log, command log in draft schema

## Ops scale

- Move from single VPS to managed Postgres + multiple API instances behind a load balancer
- Cloudflare Access in front of admin
- Separate read replicas for metrics

## Module slots

Keep new work under `apps/api/src/modules/<name>`: `multiplayer`, `flags`, `push`, `config`.
