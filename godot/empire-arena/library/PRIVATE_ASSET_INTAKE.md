# Private Library 3D/animation/audio intake — BUKLOD Genesis 2.0.6

The owner supplied these files in ChatGPT Library. They were materialized into a private working directory. **Materialization is not import, parsing, distribution permission or release verification.** Do not publish them merely because their filenames include “FREE.”

Use `scripts/genesis-private-library-intake.mjs --inspect` against the materialized directory (set `BUKLOD_GENESIS_PRIVATE_ASSET_DIR`). It checks the exact expected input bytes, GLB binary headers, GLTF JSON mesh/rig/animation metadata, and archive entries without unpacking arbitrary executable files. It emits a local JSON report. Unverified archives remain listed, not imported. Unity packages, RARs, embedded FBX and .blend files need offline conversion and rights review.

To stage a model for the game content pack, provide an **outside-the-repository** rights manifest at `BUKLOD_GENESIS_PRIVATE_RIGHTS_FILE` that binds each exact source filename and SHA-256 to a commercial redistribution right plus a local license/ownership evidence document. For an archive, the grant must cover all selected extracted assets. Only then run `--stage`. The script creates `build/genesis-private-library/manifest.json` and approved GLBs with source SHA-256 evidence; the Godot game pack imports them only with `BUKLOD_GENESIS_PRIVATE_ASSETS=true` and a second full integrity check.

No Library file IDs, authentication tokens, signed URLs, proof scans, unreviewed archive contents or private binary source assets belong in GitHub or GitHub Actions logs. The app always keeps the existing 22 independently verified CC0 3D models/2 rigged actors as fallback. The local owner preview and the staging OTA publication are separate release gates.

**Current availability:** The file service successfully materialized a subset into the session's private working container, but the container execution interface is returning ClientError. Thus the private binaries are **not yet validated, staged, or included in a verified pack**. Do not claim otherwise.
