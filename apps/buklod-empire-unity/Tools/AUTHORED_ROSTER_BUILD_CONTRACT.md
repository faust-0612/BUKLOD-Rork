# No repeated legacy hero APK
Root cause: CandidateReviewComposer.Prepare previously always imported Tools/ReviewOutput/heroes/<id>.glb from the procedural review pipeline; HeroLodReviewImporter did the same for LODs. The owner GLBs in the private studio were never used by the actual battle catalog.

Local Android build, local build preflight and isolated cloud Android preparation now require a single private authored roster manifest BEFORE assembly. Existing Editor-only diagnostic assembly remains possible without that manifest. No production release or paid build is started.

Required directory: Tools/ReviewOutput/authored-roster/
- manifest.json: {"status":"AUTHORED_ROSTER_PRIVATE_CANDIDATE","heroes":[...]}
- full/<canonical hero id>.glb and lod/<canonical hero id>.glb for all 13.
- Each manifest row: id, fullSha256, lodSha256, author, sourceUrl (HTTPS), license (CC0-1.0 or CC-BY-4.0), licenseEvidence, identityEvidence. Evidence must refer to actual records, not invented attestations.
- Use the existing canonical rig/clip contract: same bone names required by wearable/weapon systems, independent Idle/Walk/Run/Attack/Skill/Primary/Secondary/Ultimate/LegacyUltimate/Hit/Death/Victory clips, compatible full/LOD bind poses. Existing import and deformation gates still apply. Retarget an actual approved rig rather than renaming unsupported clips.
- Original procedural preparation receipt remains required as comparison baseline and for environment/factions/audio. No silent full or LOD fallback.
- Existing portrait capture invalidates stale source hashes. Final build dependency verification checks both actual imported meshes in each hero prefab, portrait dependencies and premium skill surface material.

This is a technical gate and selection route, NOT the missing 13 authored assets or proof of visual quality. The current three private owner models alone do not satisfy it; no fabricated manifest is provided. No new APK until those inputs are actually complete. Unchanged bytes are detected; different hashes alone do not prove art originality or visual improvement.
