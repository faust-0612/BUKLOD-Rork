BUKLOD Character art staging integration — 2026-11-16

Asset package: ChatGPT Library / Buklod Character System Assets / Collectibles / Processed / BUKLOD_Character_1300_Collectibles_Ready.zip.
All 1300 WebP files match the supplied 1300 SHA-256 manifest entries; source art detail is only about 73-85px wide.

Before enabling remote art: upload all files from character-collectibles/ to a public-read, service-role-write bucket.
Verify each published object SHA-256 against the processed manifest; upload published-v1.json LAST.
Set EXPO_PUBLIC_BUKLOD_CHARACTER_ART_BASE_URL in staging preview environment ONLY, pointing to HTTPS public-object bucket root.
Run node --experimental-strip-types --test tests/buklod-character-art-contract-20261116.test.mjs, tsc, character:contract, release gates.
Do not publish staging OTA before asset upload and automated gates pass. Missing/unconfigured assets keep a working icon fallback.
Moving animations are whole-illustration idle only. Real blink, nod and wave are blocked by unapproved rig segmentation.
No change to Circle Rank, points, entitlement or production configuration.