# Rork Character Asset Classification

**Status:** Classification **C** — flattened raster, not rig-ready  
**Date:** 2026-08-18  
**Source of truth:** `src/lib/character-lab-core/assets.ts` (Rork Character Lab atlas)

## Summary

The approved BUKLOD characters **cannot be articulated directly** from the shipped assets. Every approved body and wardrobe item is a **single full-body or garment PNG** with alpha. There are **no pre-cut limb segments, no skeletal mesh, and no joint-local art slots**.

Attempting to rotate limbs on these PNGs produces cardboard-cutout translation (already rejected in Pass 2/3). The correct path is **offline segmentation** of the approved reference into rig slots, then wiring those segments into the existing joint engine.

## Evidence

| Check | Result |
|-------|--------|
| Base bodies | One PNG per gender (`char_base_male` 492×1310, `char_base_female` 507×1408) |
| Wardrobe | Separate trimmed PNG layers positioned by `%` atlas (`LAYER_PLACEMENTS`) |
| Segmented limbs | **None** in manifest or R2 bucket |
| `FACE_RIG` | Landmark **percentages** for head clip + blink — not joint transforms |
| Rork `LayeredCharacter` | Composites flat layers; head group translates as one clipped unit |
| `build_layer_atlas.py` | Detects anatomy from alpha silhouette; emits placements, not rig parts |

## Classification key

| Class | Meaning | BUKLOD status |
|-------|---------|---------------|
| A | Pre-rigged skeletal/spine art | ❌ Not present |
| B | Vector SVG with grouped limbs | ❌ Not present |
| **C** | **Flat PNG composite only** | **✅ Current approved assets** |
| D | Procedural / placeholder | ❌ Must not ship (`MaleStarterArt.tsx` rejected) |

## Implication for production

1. **STOP** animation/feature work until segmented art is approved.
2. Points must show the **approved Rork composite** (static) — not generic SVG placeholders.
3. Segmentation must preserve face, proportions, hair/costume language, and emerald/gold identity from the reference PNGs.
4. Male segmented base must pass device review before female segmentation proceeds.

## Approved reference URLs

- Male base: `char_base_male` → R2 asset `349e3cf0-e155-4e94-ac15-62067087efb8.png`
- Female base: `char_base_female` → R2 asset `970dcb45-c576-45f4-be3e-20b48e92a5cc.png`

Local copies for review: `docs/character-rig-review/assets/char_base_male.png`, `char_base_female.png`
