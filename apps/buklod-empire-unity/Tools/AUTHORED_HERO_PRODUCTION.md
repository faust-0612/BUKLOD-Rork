# Authored character production — isolated DEV
The actual owner Library models contain approximately 150,000 indexed triangles each, one skinned mesh with 22 Mixamo-named joints and an embedded texture. They are high-detail source candidates, not approved gameplay geometry. The source files and exact SHA-256 are pinned in authored-hero-candidate.py. No author/license is inferred from bone naming.

## Art and animation workflow
1. Preserve the original sculpt/texture as the high-detail reference. Establish canonical hero silhouette, equipment, stone color and facial identity before binding. No generic body recolors as completed heroes.
2. Produce a weighted, UV-preserving gameplay mesh and two lower LODs from the actual authored mesh. Targets: 36k/14k/5k triangles as initial candidates, subject to deformation and measured device review. Preserve joint order, skin weights and clip inventory. Re-topologize manually if decimation damages hands, face, armor edges or silhouette. Use separate normal/material bakes for armor, cloth, face and metal where authoring permits; do not force this onto a single baked texture without source maps.
3. Require a documented per-hero mapping for Idle/Walk/Run/Attack/Primary/Secondary/Ultimate/Hit/Death/Victory. Each must be distinct; no aliasing attacks into skills. Retarget and keyframe individual anticipation, contact, recovery and weapon/hand arcs on the actual rig before binding. Lock root motion to server/local simulation; preserve original canonical game timings.
4. Unity candidate import must inspect skin deformation, Avatar/Animator, LOD transitions, camera framing, shadows and mobile frame pacing. Character selection and battle use the same approved character lineage; never use an unrelated portrait. No changes to production catalog before evidence.

## Tool
Ordinary Python audit: python Tools/authored-hero-candidate.py <exact original path>.
Blender export (only after mapping and rights evidence):
blender --background --factory-startup --python Tools/authored-hero-candidate.py -- <exact original path> --mapping <local hero mapping.json> --output <new ignored candidate directory>.

The three pinned files currently lack approved rights/identity mappings and unique complete skill clips. The script deliberately rejects these incomplete mappings, rather than creating a fake full roster. Export and Unity import are unexecuted in this environment. The existing approved-source/catalog gates remain mandatory.
