# Kabihasnang Ligaw — Visual QA checklist
## Current state
The guard script is a local Node CLI; it is not wired to the app renderer, GitHub Actions, or OTA publishing. Run from repository root: `node scripts/kl-visual-canon-validate.mjs` for inventory mode; `node scripts/kl-visual-canon-validate.mjs --release` for strict release gate. Strict mode is expected to FAIL until actual owner-approved assets are supplied. Never bypass failure.

## Review each rendered scene
- Confirm approved R31/R40 character asset by direct visual comparison; a SHA check proves file identity, not visual resemblance.
- Confirm approved setting sheet, geography, landmarks, weather, and time of day.
- Confirm exact manuscript excerpt and action, wardrobe, props, wounds, chronology.
- Reject distortions, incorrect characters, unapproved alterations, and off-story imagery.
- Require owner approval ID for the exact file bytes and a verified SHA-256.
- Keep approved originals immutable; never regenerate images on opening the story.

## Locked publication counts
12 series x 30 chapters = 360 chapters; 2–3 chapter illustrations each; 12 distinct official covers using the same approved title-picture layout. Special Characters have independent series, with only optional minor cameos in the main twelve.

## Security
Never treat a generated image, a textual description, a git blob SHA, or an AI similarity score as proof of owner approval. Missing approvals are hard blocks.
