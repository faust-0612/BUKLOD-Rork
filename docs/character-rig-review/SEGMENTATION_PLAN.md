# BUKLOD Character Segmentation Plan

**Derived from:** approved Rork PNGs + `FACE_RIG` (`assets.ts`) + `build_layer_atlas.py` silhouette landmarks  
**Goal:** Rig-ready segments that **recompose to the approved look** — no new face/body design.

---

## Segment inventory

| Slot | Parent joint | Z-order (back→front) | Notes |
|------|--------------|----------------------|-------|
| HAIR_BACK | head | 1 | Behind head; braid/crest volume |
| NECK | torso | 2 | Coupler disc — **must overlap head + torso** |
| TORSO | torso | 3 | Chest + abdomen to crotch line |
| TOP | torso | 4 | Wardrobe tunic/jacket (starter: `top_*_tunic`) |
| BOTTOM | torso | 5 | Wrap/greaves (starter: `bottom_*_wrap`) |
| LEFT_UPPER_ARM | lShoulder | 6 | Shoulder → elbow |
| RIGHT_UPPER_ARM | rShoulder | 6 | Mirror |
| LEFT_FOREARM | lElbow | 7 | Elbow → wrist |
| RIGHT_FOREARM | rElbow | 7 | Mirror |
| LEFT_HAND | lWrist | 8 | Includes thumb base |
| RIGHT_HAND | rWrist | 8 | Mirror |
| LEFT_THIGH | lHip | 9 | Crotch → knee |
| RIGHT_THIGH | rHip | 9 | Mirror |
| LEFT_LOWER_LEG | lKnee | 10 | Knee → ankle |
| RIGHT_LOWER_LEG | rKnee | 10 | Mirror |
| LEFT_FOOT | lAnkle | 11 | Sandal/boot layer |
| RIGHT_FOOT | rAnkle | 11 | Mirror |
| SHOES | root | 12 | Optional overlay if feet split from sandals |
| HEAD | head | 13 | Face skin — **no hair** |
| EYES_OPEN / EYES_CLOSED | head | 14 | Separate lids for blink |
| MOUTH_NEUTRAL (+ variants) | head | 15 | Lip sync states |
| HAIR_FRONT | head | 16 | Bangs, sweep, crest front |

---

## Horizontal cut lines (% of body box height)

Landmarks from published `FACE_RIG`. Derived rows use the same formulas as `landmarks_of()` in `tools/build_layer_atlas.py`.

### Male (`char_base_male`, 492×1310)

| Landmark | % Y | Px @1310 | Use |
|----------|-----|----------|-----|
| headTop | 0.153 | 2 | Top of head segment |
| browY | 3.893 | 51 | Brow guide |
| eyeBandTop | 3.487 | 46 | Eye slot top |
| eyeY | 4.962 | 65 | Eye pivot |
| chinY | 10.687 | 140 | Bottom of face / jaw |
| **neck** (derived) | **~11.9** | **~156** | Narrowest neck row — **head/neck pivot** |
| shoulderY | 15.420 | 202 | Shoulder joint row |
| waistY | 31.069 | 407 | Waist / tunic hem anchor |
| forearm (derived) | ~51.4 | ~674 | Wrist band — elbow/hand boundary guide |
| elbow (derived) | ~33.4 | ~438 | Mid shoulder→forearm |
| crotch (derived) | ~55.0 | ~721 | Hip/thigh split |
| knee (derived) | ~73.8 | ~967 | Thigh/shin split |
| ankle (derived) | ~96.3 | ~1262 | Shin/foot split |
| feetY | 99.847 | 1308 | Ground contact |

### Female (`char_base_female`, 507×1408)

| Landmark | % Y | Px @1408 | Use |
|----------|-----|----------|-----|
| headTop | 0.071 | 1 | Top of head |
| browY | 4.688 | 66 | Brow guide |
| eyeBandTop | 4.156 | 59 | Eye slot top |
| eyeY | 5.966 | 84 | Eye pivot |
| chinY | 12.997 | 183 | Jaw line |
| **neck** (derived) | **~14.2** | **~200** | Head/neck pivot |
| shoulderY | 16.335 | 230 | Shoulder joint |
| waistY | 31.037 | 437 | Waist |
| forearm (derived) | ~52.0 | ~732 | Wrist band |
| elbow (derived) | ~34.2 | ~481 | Elbow row |
| crotch (derived) | ~55.5 | ~781 | Hip split |
| knee (derived) | ~74.2 | ~1045 | Knee row |
| ankle (derived) | ~96.4 | ~1357 | Ankle row |
| feetY | 99.858 | 1406 | Ground |

**Derived formula** (matches atlas builder):

```
body_h = feetY - headTop
neck_y  ≈ chinY + 0.012 × body_h
crotch  ≈ headTop + 0.55 × body_h
forearm ≈ crotch - 0.035 × body_h
waist_atlas = crotch - 0.14 × body_h   (cross-check: ≈ FACE_RIG.waistY)
knee      ≈ crotch + 0.42 × (feetY - crotch)
ankle     ≈ feetY - 0.035 × body_h
elbow     ≈ (shoulderY + forearm) / 2
```

---

## Vertical / lateral cut strategy

Arms hang beside the torso in the approved A-pose. Use **silhouette-aware cuts** (not straight vertical slices):

1. **Torso mask:** At each row, keep the **middle run** of alpha pixels (ignore arm blobs) — same as `middle_run()` in atlas builder.
2. **Upper arm:** Extract lateral blob from shoulderY → elbow, outside torso middle run + 2px seam overlap.
3. **Forearm:** elbow → forearm landmark row.
4. **Hand:** forearm row → fingertips; include 4px overlap into forearm.
5. **Thigh:** crotch → knee, inner edge follows leg gap between runs.
6. **Shin / foot:** knee → ankle → toes; sandals (`shoes_*_sandals`) align to `LAYER_PLACEMENTS` foot baseline.

### Head window (existing Rork blink clip — reuse for rig)

From `LayeredCharacter.tsx`:

```
headWindow.left   = headCenterX - headWidth × 0.78
headWindow.top    = headTop - 1.1%
headWindow.width  = headWidth × 1.56
headWindow.height = chinY - headTop + 2.6%
```

Male: center X 49.39%, head width 29.878%  
Female: center X 48.718%, head width 30.572%

---

## Joint pivot points (% of body box)

Pivots are **joint-local (0,0)** for each segment PNG. World placement comes from the skeleton engine.

| Joint | Male pivot (x%, y%) | Female pivot (x%, y%) | Segments attached |
|-------|---------------------|------------------------|-------------------|
| root | 49.39, 55.0 | 49.112, 55.5 | Whole figure origin at hips |
| torso | 0, 0 (parent root) | same | TORSO, TOP, BOTTOM |
| neck/head | 49.39, 11.9 | 48.718, 14.2 | HEAD, HAIR, EYES, MOUTH |
| lShoulder | 38.5, 15.4 | 38.0, 16.3 | LEFT_UPPER_ARM |
| rShoulder | 60.3, 15.4 | 60.2, 16.3 | RIGHT_UPPER_ARM |
| lElbow | end of upper arm | same | LEFT_FOREARM |
| rElbow | end of upper arm | same | RIGHT_FOREARM |
| lWrist | end of forearm | same | LEFT_HAND |
| rWrist | end of forearm | same | RIGHT_HAND |
| lHip | 44.0, 55.0 | 44.5, 55.5 | LEFT_THIGH |
| rHip | 54.8, 55.0 | 53.7, 55.5 | RIGHT_THIGH |
| lKnee | end of thigh | same | LEFT_LOWER_LEG |
| rKnee | end of thigh | same | RIGHT_LOWER_LEG |
| lAnkle | end of shin | same | LEFT_FOOT + shoe |
| rAnkle | end of shin | same | RIGHT_FOOT + shoe |

Shoulder X derived from silhouette: ~bodyCenterX ± (chest_span/2 − 4px). Re-verify per gender after cut.

**Neck coupler:** Minimum 13px radius disc (see `neckCouplerR` in `skeletonMale.ts`) filled with neck skin tone — prevents head detach on NOD.

---

## Starter loadout mapping

From `defaultEquipment()`:

| Slot | Male catalog id | Asset key | Female catalog id | Asset key |
|------|-----------------|-----------|-------------------|-----------|
| base | base_male | char_base_male | base_female | char_base_female |
| top | top_tunic | top_m_tunic | top_tunic | top_f_tunic |
| bottom | bottom_wrap | bottom_m_wrap | bottom_wrap | bottom_f_wrap |
| shoes | shoes_sandals | shoes_m_sandals | shoes_sandals | shoes_f_sandals |
| hair | m_hair_crop | *(baked in base)* | f_hair_knot | *(baked in base)* |
| face | face_natural | *(none)* | face_natural | *(none)* |

**Note:** Starter hair ids have no separate PNG — hair is part of the base body. Optional hair layers (e.g. `hair_m_sweep`, `hair_f_waves`) are wardrobe overlays for review composites.

---

## Segmentation workflow (authoring)

1. Import approved base PNG at native resolution (do not downscale).
2. Run alpha silhouette landmark detection (or manual confirm against table above).
3. Paint **seam overlap** (3–6px) on every cut — especially neck, shoulders, hips.
4. Export each slot as PNG with pivot at joint, transparent outside segment.
5. Recompose in neutral pose — pixel-diff against flat reference must be ≤ 1px seam tolerance.
6. Repeat per gender — **no stretch** between male/female skeletons.
7. Wardrobe segments follow body segments (TOP splits at shoulder/elbow not required if cloth is single mesh per arm — prefer **duplicate cloth per limb** for clean bend).

---

## Explicitly rejected

- Generic SVG capsules/circles (`MaleStarterArt.tsx`)
- Elderly or stylized alternate faces
- Single shared skeleton with scale-to-fit female
- Whole-body rotate as "wave" or "point"

---

## Review artifacts

- `review.html` — interactive cut-line overlay on approved PNGs
- `assets/` — downloaded reference + starter wardrobe PNGs
- `ACCEPTANCE_CHECKLIST.md` — sign-off gates before animation resumes
