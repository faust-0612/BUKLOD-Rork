# Character Rig Review — Start Here

**Status:** Art freeze — animation paused until segmentation approved.

## Open the visual review

1. Open **`review.html`** in Chrome or Edge (double-click or drag into browser).
2. Ensure the page loads from this folder so `assets/` paths resolve.
3. Toggle **Starter loadout composite** vs **Base body only**.
4. Enable **Segmentation cut lines** and **Joint pivots** to inspect proposed cuts.

## Documents

| File | Purpose |
|------|---------|
| `CLASSIFICATION.md` | Confirms Classification C — flat PNG, not directly riggable |
| `SEGMENTATION_PLAN.md` | Cut boundaries, pivots, wardrobe mapping, authoring workflow |
| `ACCEPTANCE_CHECKLIST.md` | Sign-off gates before animation resumes |
| `assets/` | Local copies of approved Rork base + starter wardrobe PNGs |

## Production behavior

While art is under review, Points renders the **approved Rork composite** (static PNG layers), not generic SVG art.

- Flag: `src/lib/characterRigArtFreeze.ts` → `USE_APPROVED_RORK_COMPOSITE = true`
- Component: `src/components/points/BuklodCharacterApprovedComposite.tsx`

## What to approve next

1. Segmentation cut lines on male reference
2. Segmentation cut lines on female reference
3. Starter loadout composite matches Rork lab look
4. Author segmented PNG slots per `SEGMENTATION_PLAN.md` (external art pass)

No commit, push, or deploy until physical device review passes.
