# BUKLOD World — PNG stage animation (DEV foundation, NOT activated)

**Decision:** No new `.riv` file is required for Lot, House, Farm, Cluster,
Organization or Business construction views. Use React Native's existing
`Animated` and statically bundled PNG assets. Keep Rive for distinct real
character rigs when fully approved; do not change or remove the installed Rive
native dependency.

## Integration contract

- `src/features/world/worldDevelopmentCatalog.ts` is the existing immutable
  10-level/5-stage preview contract for `personal_lot`, `house`, `farm`,
  `cluster` and `organization`. `WORLD_DEVELOPMENT_ENABLED` remains `false`.
- `business` is an **art namespace only**, not a newly activated progression,
  BP source or economy gate. Its server-authoritative levels must be designed
  and verified separately before user-visible upgrades exist.
- In `WorldSpriteProgress`, `level` is highest completed level (0–10).
  `stage=1..5` identifies five ordered construction phases for the NEXT level. When server
  confirms completion, set `level+1, stage=0` with a higher revision.
- A verified backend receipt and authoritative server snapshot are prerequisites
  for displaying *verified* construction. Local design previews are always
  labeled previews and can never replace a verified same-world frame.
- Do not claim upgrades or transfer BP from image/animation callbacks. Use
  transactional, idempotent backend settlement with RLS/ownership checks.
- Prevent old account art appearing when switching world IDs. Reject stale or
  conflicting revisions and explicitly label missing art instead of inventing
  higher-quality buildings.
- Renderer only starts animation while `active` and accessibility reduced motion
  is OFF. No timers, media streams, new native modules, music playback or network
  requests are introduced.

## Asset naming and packaging

Artwork is **not present** under `assets/season2/` in the inspected Nov 21
world-map DEV branch. Do not create imports for non-existent files.

| Track | Prefix | Sample completed frame | Sample in-progress frame |
| --- | --- | --- | --- |
| Personal Lot | `lot` | `lot_l01.png` | `lot_l02_s01.png` |
| House | `hou` | `hou_l01.png` | `hou_l02_s01.png` |
| Farm | `far` | `far_l01.png` | `far_l02_s01.png` |
| Cluster | `com` | `com_l01.png` | `com_l02_s01.png` |
| Organization | `org` | `org_l01.png` | `org_l02_s01.png` |
| Business (art only) | `biz` | `biz_l01.png` | `biz_l02_s01.png` |

For each activated track, supply ten completed-level frames (`_l01` through
`_l10`) and five unique stage frames for each construction level
(`_l01_s01`..`_l10_s05`), or use the stage-5 PNG as the completed-level image
under two explicit registry keys. All frames need consistent crop, transparent
background, camera angle, scale and license evidence; preferably 1024+ pixel
master artwork with optimized phone-sized PNG/WebP derivatives. High levels must
show materially larger structures, not a recolored finished building.

Place approved assets in `assets/season2/world-construction/png/` and create a
literal Metro registry in a future asset commit. Example **only after file exists**:

```tsx
export const WORLD_SPRITES = {
  hou_l01: require('../../../assets/season2/world-construction/png/hou_l01.png'),
  hou_l02_s01: require('../../../assets/season2/world-construction/png/hou_l02_s01.png'),
} as const;
```

Metro `require()` paths must be static; do not substitute a runtime concatenated
path or scan the filesystem at runtime. If just `_lNN` images exist, the renderer
can cross-fade on completed level changes; during construction it retains the
previous completed image with an explicit "artwork pending" notice.

## Rendering usage (when gated screen/verified asset pack exists)

```tsx
<WorldLevelSprite
  progress={{ worldId, track:'house', level:completedTier, stage:nextStage,
    revision:serverSceneRevision, origin:'authoritative_server',
    receiptId:serverVerifiedReceiptId }}
  sprites={WORLD_SPRITES} width={280} height={200}
  active={isFocused && appIsActive}
/>
```

There is deliberately **no live screen wiring**, no RLS changes, no points
changes, no Season 2 unlock, and no OTA in this patch. Before release: install
and check original owned art, validate genuine backend snapshots and receipt
provenance, build stage-to-frame registry, test Android low-memory and rapid
updates/scope switching, verify visual acceptance, ads, navigation and actual
staging APK compatibility. No claim of conso OTA readiness until complete.
