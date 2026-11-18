# BUKLOD Season 2 Circle Rank Avatar Visual Contract

Status: DEV implementation, staging-only candidate. No Season 1 points, QMP, payouts,
Season 2 grants, RLS, auth, release channel or production runtime mutations.

## Artwork authority
Owner-approved visual sheets are archived in Library folder **Buklod rank badges**.
The included offline WebP atlas is 5 columns (V, IV, III, II, I), 8 rows
(Starter, Active, Steady, Builder, Impact, Vanguard, BUKLOD Prime,
BUKLOD Prime Elite), corresponding to canonical public.buklod_rank_levels orders
1..40. The 40 original silhouettes were segmented into independently
transparent PNGs, included separately in the delivery ZIP. The atlas retains
the transparent shapes and fixed no-neighbor sprite cells; do not render a
square thumbnail or clip any ornaments.

## UI contract
- Shared ProfileAvatar is the single authoritative avatar decorator for Wall,
  comments, post detail, Connect, conversations, people search, member list,
  and Profile. Wrappers must have visible overflow.
- Decoration at 10 o'clock, 0.68 avatar-size artwork. Rank border family color
  changes with verified server rank; avatar photo itself remains circular/rounded.
- Bottom-center (6 o'clock) BLUE dot only while the shared Realtime session
  reports online; unknown/offline renders no dot. Upper-right Notes and unread
  badges must remain separate. Presence is cosmetic and must never confer rights.
- Canonical ranks are obtained through get_member_circle_ranks_v1 in bounded,
  account-isolated 32-user batches. Wall/Connect can supply their server-reported
  rank to avoid blank flash; RPC truth takes precedence.
- Never infer rank from displayed name, season tier, local points or QMP.
- Locked/unearned roadmap badges remain dimmed but recognizable.

## Staging gates
- Verify 40 unique canonical badge slots and alpha shapes.
- React Native TypeScript and Android bundle decode of offline WebP.
- Wall/Connect/profile/comment/small avatar screenshot QA at 38/42/48/72/120 px
  with Notes and bottom online dot. Weak network no rank/online fabrication.
- Verify one rank RPC batch per 32 visible IDs; one presence channel per
  authenticated session (not per avatar), no first-view AdMob/nav regression.
- No Season 2 production push before Dec 6 or owner’s later release approval.
