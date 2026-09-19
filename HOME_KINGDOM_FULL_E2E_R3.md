# BUKLOD Home + Kingdom Standalone Full E2E R3

Status: **NOT DONE** until automated R3 and the authenticated browser finalizer both pass on the exact same feature head.

## Scope

Web-only standalone Home and Kingdom. BUKLOD Main native, Android, iOS, Quiz, Classroom, QuickCheck, and unrelated stable modules remain frozen.

## Backend E2E already executed (rollback-safe)

### Kingdom authoritative progression

Executed against BUKLOD Connect inside explicit database rollback transactions using authenticated non-admin context.

Verified:
- server-backed Kingdom state resolves for an authenticated non-admin account
- Circle Rank locked region rejects result submission
- first Level 1 clear advances the region to Level 2
- first clear grants server-calculated Kingdom XP and Game XP
- 3-star first clear grants the canonical collectible
- duplicate `client_result_id` is idempotent and does not create a second reward event
- replay of a previously cleared level grants 0 additional first-clear XP
- replay does not duplicate the collectible
- level details reflect the next unlocked level
- all QA writes were rolled back

Observed first-clear sample from the rollback transaction:
- Kingdom XP award: 123
- Game XP award: 215
- collectible: `phan-enterprise-founder-seal`
- replay XP: 0 / 0
- cleared levels after first clear: 1
- current level after first clear: 2

### Bahay backend

Executed inside rollback transactions under authenticated RLS using two existing test identities. No QA home, invitation, task, message, reward, plant, poll, or community record was retained.

Verified:
- create Bahay
- invite second member
- accept invitation
- active two-member directory
- shared task completion
- Garden Energy from eligible completed task
- second-adult task confirmation
- Bahay message insert/read path
- poll create/options/vote
- notification preference upsert
- Garden plant and water
- community create
- second home join by code
- owner and member community goal writes
- community message write
- RLS-scoped member visibility

Rewarded Garden backend verified independently:
- first unique reward token: granted, energy +1
- duplicate token: rejected, no extra energy
- second unique token: granted
- third unique token: granted
- fourth unique token: rejected at daily cap
- exactly 3 reward rows / +3 Garden Energy in the transaction
- transaction rolled back

### Reward/recurrence integrity blocker found and fixed

The full-button audit exposed two backend exploits in the old completion function:
- DONE -> pending -> DONE on a recurring task spawned duplicate future occurrences.
- DONE -> pending -> DONE could grant Garden Energy repeatedly for the same task.

Live migration `20260919164940_buklod_bahay_completion_reward_idempotency_r3` fixes both:
- one completion-energy grant per item
- one recurrence successor per source occurrence
- internal reward/recurrence markers are stripped from each spawned child so every new occurrence starts clean
- legacy recurrence rows self-heal by adopting an already-existing exact next occurrence

Live rollback retest after deployment verified:
- one rotated successor after repeat toggles
- next assignee rotation works
- confirm -> undo -> confirm still grants once and spawns once
- REJECT -> recomplete -> CONFIRM works
- CHILD/ADULT/PRIVATE visibility enforcement works
- Stage-5 Garden harvest awards seeds once
- post-harvest water does not consume energy

### Infrastructure

Verified live:
- `buklod-home-ai` Edge Function ACTIVE with JWT verification
- `buklod-home-drawer` Storage bucket exists
- drawer Storage object policies present
- 9 Bahay realtime tables present in `supabase_realtime`
- `buklod-surface-main-entry-v1` ACTIVE with JWT verification
- unauthenticated handoff request returns HTTP 401

## Recovered regression

The later presentation branch had replaced the proven server-backed Kingdom client with local preview progress. R3 restores the server-backed **web-only** client from the earlier proven E2E branch while keeping native files frozen:
- `src/features/games/kingdom/progress.web.ts`
- `src/features/games/kingdom/BuklodKingdomMap.web.tsx`

The web client now uses:
- `get_my_buklod_kingdom_v1`
- `submit_my_buklod_kingdom_result_v2`
- `get_my_buklod_kingdom_level_details_v1`

It preserves offline pending-result retry, duplicate-result suppression, server rank locks, 20-level state, Kingdom/Game XP, mastery, and collectibles.

## Final DONE rule

Do **not** mark this work DONE unless all of the following are true on one exact release candidate:
1. TypeScript clean.
2. R3 source/backend-wiring contract PASS.
3. Home standalone export PASS.
4. Kingdom standalone export PASS.
5. All Home and Kingdom direct routes return the SPA safely.
6. Main -> Home authenticated handoff PASS, token hash cleaned, refresh persists.
7. Main -> Kingdom authenticated handoff PASS, token hash cleaned, refresh persists.
8. All Bahay visible controls are exercised or covered by the rollback backend E2E above, with browser rendering/error/back behavior verified.
9. All 4 Home tool screens and every visible action are exercised.
10. All 13 Kingdom games open and every current game control is exercised to a result.
11. Result persistence/reward change is visible after returning to the Kingdom map.
12. Locked Kingdom station cannot be opened.
13. Direct standalone access without a session shows the Main-entry guard.
14. Back navigation and refresh produce no white screen.
15. Main-owned bridge routes return to Main.
16. No native or unrelated regression.
17. No production deployment occurs before this gate passes.
