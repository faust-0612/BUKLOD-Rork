# Kabihasnang Ligaw — Visual Canon Guard v1 (R31/R40)

Status: ENGINEERING SPEC / APPROVAL GATE; NOT production-deployed.

## Non-negotiable scope
- 12 main series, exactly 30 chapters each; each chapter 2–3 scene-accurate illustrations; one official title/cover layout per series.
- Eight Special Characters retain separate series; optional small cameos only.
- Approved R31 core and R40 special BUKLOD character art are immutable identity references. Confirm actual asset bytes and hashes before generation. These are NOT automatically approved environment illustrations.
- Every setting requires an owner-approved location sheet (architecture, geography, landmark positions, lighting, palette, time/season changes).
- No arbitrary character redesign, costume reset, landmark relocation, or inconsistent carried objects/injuries.

## Required manifests
character_id, approved_reference_asset_paths, sha256, facial/hair/body/color/costume invariants, permitted_story_changes;
setting_id, approved_reference_asset_paths, sha256, geography, landmarks, architecture, weather/time variants;
scene_id, series, chapter, narrative_excerpt, character_ids, setting_id, exact_actions, props, time_of_day, preceding_scene_id;
asset_id, source_scene_id, reference_hashes, generator_version, prompt_revision, render_sha256, QA findings, owner_approval_id, status.

## Production-safe pipeline
1. Retrieve approved R31/R40 actual binary files and approved setting references; fail closed if missing or mismatched.
2. Build chapter scene sheets from the approved manuscript; reject speculative or unrelated visuals.
3. Generate using immutable reference assets, never text-only reconstruction.
4. Automatic checks: reference hashes, character/setting IDs, expected count, cover template fields, dimensions, missing props, and continuity metadata. Image similarity detection is advisory, not proof.
5. Human review: face/identity, age, hair, clothes, geography, objects, action, temporal continuity, image artifacts, story alignment.
6. Owner approves exact rendered bytes. Persist SHA-256 and immutable asset ID. Rejected or unreviewed files cannot be marked official.
7. Publishing must fetch the exact approved asset ID/hash; no on-open regeneration or fallback substitution. Any changed bytes invalidate approval.

## Hard blocks
Missing canonical reference; missing setting approval; failed scene check; incorrect character; owner approval absent; wrong hash; unapproved cover template; fewer than 2 or more than 3 chapter images.

## Rollout
Read-only asset inventory -> visual bible and setting sheets -> offline QA pilot on one approved chapter -> owner approval -> targeted DEV implementation -> immutable RC -> production release gates. No unrelated BUKLOD changes, no production OTA on this spec alone.
