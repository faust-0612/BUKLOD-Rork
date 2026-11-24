# Arena progression & stewardship — graded V2 DEV candidate
2026-11-24. Supersedes binary teamwork/objective/rescue/resource rewards. Existing Character System remains authority; 13 hero IDs and canonical V3 checkpoint lock preserved. Arena BP never changes Community BP, Circle Rank, QMP, cash or academic credit.
## Graded performance
E 0–29, D 30–49, C 50–64, B 65–79, A 80–89, S 90–94, S+ 95–100. Eight categories: teamwork, combat, objectives, support/healing/rescue, resource efficiency, village development, defense/protection, leadership. XP per category E/D/C/B/A/S/S+ = 0/2/5/10/20/30/50; teamwork = 0/2/5/10/15/25/40. Aggregate performance bonus capped at 300 XP/match; no separate rescue/teamwork/objective award to double-count. Base XP 20 completion, 30 victory, 25 MVP (minimum A grade), 50 first daily victory. One-time mission tiers 50/100/200; rewarded-match milestones 10/25/50 at 100/250/500 XP.
Overall grade is weighted by hero kit. Each profile totals 100; at least 3 scored categories, 60% role-weight coverage and teamwork required. Unavailable opportunity is N/A and excluded; poor play is 0, not N/A. Verified match service supplies deduplicated aggregate facts per category: effective contribution, role/opportunity target, successful actions, attempted actions, difficulty (0–100). SQL computes 70% actual impact (effective/target capped at 1), 20% efficiency (success/attempt), 10% impact-weighted difficulty. Zero effective contribution scores zero. N/A requires verified lack of opportunity; it is not a zero. No raw client stats or unverified claims. Normalize successful/attempted events by meaningful action windows; no healing overheal, self damage, revived-unit double kills, repeated drops, deliberate friendly harm, duplicate deposits or collusive event credit. Virtue Score 0–100 measures observable teamwork/sportsmanship, not religion or personal worth; informational only, no reward multiplier, no public moral ranking.
## Arena BP
+3 completed match, +2 victory, grade bonus E/D/C/B/A/S/S+ = 0/1/2/3/4/6/8. Maximum 13 BP/match (supersedes prior 8), 30 BP/day, first five eligible reward-bearing matches/day. Practice unlimited, no permanent rewards. Grade E, loss, low skill and outage never deduct BP. Confirmed intentional AFK −5, abuse −10, cheating −20, daily deduction cap 20, balance floor zero. Penalties require adjudicated evidence; no automatic penalty for reports, low grades or accidental disconnect. Appeal/refund workflow and automatic sanctions remain disabled until reviewed.
100 Arena BP buys one matching Sacred Stone in shared inventory; existing spendable Community BP route unchanged. One stone per competitive match, free practice; no QMP/cash linkage or pay-to-win.
## Feedback
Immutable per-match receipt contains category grades, scored weights, raw/capped performance XP, base XP, milestone XP, overall grade, informational virtue score, BP before/after cap, reason. Identical retries return original receipt, conflicting facts rejected. Receipt includes best and lowest scored categories, plus daily BP-cap flag; show them as coaching feedback when UI adapter is connected; no forced gaming streaks, wagering or paid score boosts.
Existing evolution L1–4 Awakening, 5–9 Emergence, 10–14 Ascension, 15–19 Transcendence, L20 Awakened Legend. Cosmetics only in ranked; match level resets. Existing server level thresholds unchanged.
## Release gates
SQL intentionally outside migrations and private with no grants. Authoritative multiplayer event normalization, eligibility (exclude Official), anti-collusion/opponent diversity, score/role balance calibration, season MMR, all-13 collectible UI/ownership integration, appeal/reversal, retention limits, read-only signed receipt API, PostgreSQL concurrency/RLS and Unity/Android tests remain required. No production, OTA or paid build.

### Category evidence guide (server adapter contract)
| Metric | Count effective events only |
|---|---|
| Teamwork | Verified assists, coordinated objectives, rescue participation; no chat spam |
| Combat | Relevant enemy damage and contribution to successful engagement; no repeated victim farming |
| Objective | Capture/defense, tower or boss contribution, and contested objective completion |
| Support | Actual ally health restored, effective shield absorption, legitimate saves |
| Resource | Distinct delivered usable resources, verified spend efficiency; no self-transfer loops |
| Village | Useful completed construction, repairs, production and sustained economic contribution |
| Defense | Damage mitigated near threatened ally/structure, meaningful zone protection |
| Leadership | Successful coordinated pings/orders verified by outcomes, not number of commands |
Opportunity target must derive from role, duration, mode and opposing skill. Difficulty and opportunity cannot be chosen by the player. The 13 role profiles are provisional calibration, not proven match balance.
