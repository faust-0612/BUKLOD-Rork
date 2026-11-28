# Library-first original art intake

All 36 exact GLB source blobs are by Quaternius and licensed CC0-1.0 (https://creativecommons.org/publicdomain/zero/1.0/). See manifest.json for each source URL, mirror, commit, exact file, bytes, blob hash, and static role binding. 23 static review prefabs map 16 structures, 5 resources, and 2 pickups. Each is bound through the isolated scene composer and validated as a build dependency; previous geometry is only used to measure a footprint. Deer and Wolf are source-bound to AzureStag and CrimsonWolf with their own imported idle/attack/hit/death clips and derived tints. Snake and eight monster models remain unbound source candidates pending identity/animation compatibility. Both loot prefabs retain a real Crystal2 mesh as the colorable tier/cargo marker, preserving existing runtime color logic. No generic substitution for missing heroes or villagers. Runtime import and render not verified. No release approval. Stage 1 device verification deferred by owner.

## Empire startup branding

- Source: owner-provided [Animated Golden BUKLOD Empire Logo.gif](https://chatgpt.com/library?file_id=libfile_b95f98cc36f881919f2cc723dcc464d2&account_id=personal). Attribution: BUKLOD Empire owner-supplied branding. Use: owner-authorized BUKLOD Empire startup only. No third-party or open license is asserted.
- Source SHA-256: `825b32c7e647d585a30a9136d6c72f4e63438900f21dcc4961eba29568383f34`.
- Unity dependency: `Assets/Resources/EmpireBrand/StartupLogo.jpg`, loaded by the offline review menu. SHA-256: `5c57a704633558a22e0ec0049a3bdb309adf43e80ea3e78c15b153cd3ba7bce1`.
- Import conversion: composite the twelve 358 × 358 GIF frames in row-major order into a four-column, three-row RGB atlas. Playback uses the source's 180 ms per frame. Only the atlas is included in the project.
