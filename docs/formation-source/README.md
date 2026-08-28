# BUKLOD Formation Source Materials

## Authoritative files (verified Implementation 006)

| File | Pages | SHA-256 |
|------|-------|---------|
| `church-care-process.pdf` | 98 | `8928478636537522E01E9D11273C59783C404C4835D8DEAC007196FCA82323C5` |
| `advance-discipleship.pdf` | 145 | `79540AD937640137E5880829A5B7ECCFAD6809B23BE461A5E18C48759DDE528C` |
| `mga-kasunduan.pdf` | 5 | `C242BDDA897CD3658BEAF6B316761C290482FD87977D72564383000DB870B0AE` |

Legacy DB filenames: `CCP Consolidated.pdf`, `ADVANCE DISCIPLESHIP LESSONS.pdf`

Extracted text (for import tooling): `supabase/seed/formation/extracted/`

## BUKLOD 105 Level 1 discrepancy (auditable)

| Source | Claim |
|--------|-------|
| Church Care Process overview | Leadership Lesson 1 = **9 aralin** |
| Advance Discipleship (detailed) | **ARALIN 1–10** numbered (ARALIN 5 body **missing** in PDF) |

**Operational resolution:** `DETAILED_CURRICULUM_SOURCE_WINS_FOR_OPERATIONAL_LESSON_SEQUENCE`

- 10 lesson slots (ARALIN 1–10)
- 9 lessons with authoritative body imported
- Slot 5 = `AWAITING_SOURCE_BODY` (not invented)

## BUKLOD Care Covenant (104)

Official full covenant body is **not** in available source files. Status remains:

**AWAITING_OFFICIAL_TEMPLATE**

## Regenerate import SQL

```bash
node scripts/extract-formation-pdf.mjs
node scripts/build-formation-006.mjs
node scripts/assemble-migration-006.mjs
```
