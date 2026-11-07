# KL Admin Release Now — Exact Server ID & Desktop Click Repair (2026-11-07)

## Production evidence (read-only)
- Authenticated Supabase public.kl_admin_action_v1 authorizes **active system_admin** accounts; release additionally requires a prepared private preview, every media item approved, status approved/approved_at set, a >=100-character manuscript and an episode not yet released. It returns {ok:true,...} only after update.
- KL chapter state reviewed 2026-11-07: chapter 0 and 1 draft; chapters 2-3 already released; chapter 4 draft without manuscript or prepared preview and with one unapproved media. No chapter was modified or released by this audit.
- `klDatabaseId(episodeNumber)` generates legacy IDs. Production chapter 4 is stored under a different server UUID, so using the legacy calculation to Approve, Reject, Preview or Release its row returns `Episode not found`.
- KLReaderScreen currently renders a Pressable chapter card around nested Pressable admin controls. React Native Web desktop can route nested pointer activation ambiguously. Release Now also offers Confirm for drafts and non-existent rows, hiding why the server refuses.

## Fix
- Fetch `kl_admin_list_v1` for the signed-in system administrator, match chapter by season_number and episode_number, and carry the **server row UUID** to admin preview and every write RPC. Refuse synthetic ID fallback when rows are absent.
- Make the chapter navigation button a sibling of its admin action buttons; each remains independently clickable, with explicit accessibility roles.
- Release Now opens a chapter-specific preflight. Show status and actionable blockers (save manuscript, prepare private preview, approve) or already-released notice. Confirm is disabled until ready, and a second explicit click is still required.
- On confirm, re-fetch server state, serialize writes with in-flight lock, require server JSONB `ok: true`, confirm `release_at` and the chapter's presence in public `kl_list_library_v1`. Never declare success on a request alone.
- User-facing feedback is shown per chapter, with a Refresh Status button. The database still independently checks all media and manuscript length at release time.

## Boundaries
No Supabase schema or data mutation, no release/approval triggered by this source patch, no Android OTA, no changes to KL prose/media/canon or unrelated app modules. Preserve server authorization and manual publication. Release pipeline still DEV -> passing CI -> Main -> verified frozen RC -> production Expo Hosting action and independent live verification.
