# Character Rig Art — Acceptance Checklist

**Review before any animation coding resumes.**

Open `docs/character-rig-review/review.html` in a browser (Chrome/Edge). Toggle overlays and compare male/female starter composites against your approved Rork reference.

---

## A. Asset classification

- [ ] Confirmed Classification **C** (flat PNG only) — see `CLASSIFICATION.md`
- [ ] Agreed segmentation is required; direct PNG rigging is out of scope

## B. Visual identity (both genders)

- [ ] Youthful face — **not** elderly or generic placeholder
- [ ] Same fantasy styling as Rork reference (emerald/teal/gold palette)
- [ ] Same body proportions as approved base PNG (no stretch/squash)
- [ ] Same hair/costume language as starter loadout
- [ ] Premium skin rendering preserved (not flat cartoon)

## C. Segmentation plan

- [ ] Cut boundaries in `SEGMENTATION_PLAN.md` approved (or annotated with corrections)
- [ ] Neck coupler overlap sufficient — head must not detach on NOD
- [ ] Arm/leg seams hidden at rest pose
- [ ] Eyes and mouth separable for blink / lip sync
- [ ] Hair front/back split approved
- [ ] Clothing segments align with body segments

## D. Rig-ready deliverables (next authoring phase)

- [ ] Male segment PNG set exported at native resolution
- [ ] Male neutral-pose recompose matches flat reference
- [ ] Female segment PNG set exported (after male passes)
- [ ] Female neutral-pose recompose matches flat reference
- [ ] Pivot metadata JSON per slot wired to `character-rig/contract.ts`

## E. Motion proof (only after D passes)

- [ ] BLINK — eyelid state change
- [ ] NOD — head rotates at neck, no gap
- [ ] WAVE — shoulder + elbow independent
- [ ] POINT — arm extends without whole-body slide
- [ ] CELEBRATE — arm motion, not particles only

## F. Production safety

- [ ] `MaleStarterArt.tsx` **not** shown in Points (approved composite only)
- [ ] Device review on physical hardware before commit/deploy

---

**Approver:** ___________________  
**Date:** ___________________  
**Notes:**
