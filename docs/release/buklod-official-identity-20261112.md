# BUKLOD Official Identity — 2026-11-12

## Scope and authorization
Convert the **existing** protected `OFFICIAL_SYSTEM_ADMIN` user (not every `system_admin`) into the BUKLOD platform voice. Preserve auth UUID, existing roles, privileged operations, and historical audit/finance data. The public profile shows **BUKLOD** and a server-verified official badge; the original personal display name and original avatar path are retained only in the private snapshot.

## Economy isolation
- No new BUKLOD member Points credits/evaluations, Community QMP events/accounts, R36 BCU, R38 RCU, Kingdom shard/member-rank progression, mission/day rewards, redemption requests or Finance user settlements.
- Keep original historical ledgers, monthly account snapshots, prior settlement decisions, and existing Finance person identity.
- Exclude the protected account from Points and Bayanihan leaderboards *before* rank assignment, from open-period QMP Finance numerator and denominator, and from future payout eligibility. Do not alter already finalized historical amounts.
- Others' engagement with official posts continues to use ordinary anti-farming and monetization policies. Posting/reacting/replying by the official identity is not itself a member reward.

## Official interactions
The admin-only `/admin/buklod-official` console uses existing Community Wall, System Announcements, Spotlight/Mission Bulletins, and BSOC support screens. This is an official operations console and **not** a duplicate social backend. It reports official posts/replies/bulletins without member Points. Auth is checked by server RPC, not client display labels.

## Validation and promotion
1. Run migration transactionally in **ROLLBACK** mode with assertions for protected UID, preserved admin role, unaffected ordinary member, no official Points insert, dashboard access, and exclusion from all-time Points ranking.
2. Verify dedicated TypeScript CI/contract tests on exact isolated SHA. Avoid touching video playback, ads, app routing or unrelated consolidated fixes.
3. Promote schema migration only after release gates. Confirm migration ledger, authenticated/anonymous access, current and historical counts, private snapshot RLS, data integrity, and security advisories.
4. Reconcile into consolidated Android/web RC; confirm exact SHA, runtimeVersion and build target, and test the official account on actual devices. Publish Production OTA only once the verified RC is accepted.
5. Validate rollback plan: recover original profile branding from private snapshot only through an authorized security migration, not by modifying ledger or settlement history.

## Known boundaries
- User-facing console/UI modifications are **DEV only** until a compiled RC and OTA.
- No automatic posting or greetings scheduler has been invented; the console links to existing authorized tools.
- The private original identity snapshot is intentionally **not** exposed by any client RPC.

## 2026-11-12 AdMob-only financial source segregation

User revenue-sharing is funded **exclusively** by verified/reconciled AdMob receipts. AdMob estimates are not cash. R38 sponsorship inventory, other app income, subscriptions, donations, grants, local ad sponsorships and product income remain separate BUKLOD business revenues and cannot enter the member QMP/first-line/community payout numerator.

The R38 legacy period has its own full-platform revenue total, but any user-pool estimate is computed from reconciled AdMob-only revenue, not sponsorship. Final payouts continue solely through Finance V3. The canonical admin reporting response exposes separate provider-finalized AdMob, Finance V3 AdMob journal, other-app revenue and other-app costs; Finance V3 member settlement remains disabled until verified funding and regular gates are satisfied.

The Finance V3 finalizer rejects historical non-AdMob eligibility rows in any unfinalized month, and QMP readiness/settlement excludes the protected BUKLOD Official account. No historical cash movements, held balances, or ledger entries are deleted or reset.
