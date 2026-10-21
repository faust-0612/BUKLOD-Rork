# Kabihasnang Ligaw R5 — Chapter 1 scene-accurate storyboard

Status: **PROVISIONAL — NO FINAL ASSETS APPROVED**. Canonical text files are now present:
- `content/kabihasnang-ligaw/panimula.md`
- `content/kabihasnang-ligaw/kabanata-01.md`

Do not publish, schedule, or set illustration `approved=true` from this document. The prose is owner supplied; media is not. These are literal start/end paragraph anchors to resolve against the imported manuscript, not guessed paragraph numbers. If an anchor fails to match exactly once, block that scene. Preserve chronological reading order and spoilers.

| Scene | Start anchor | End anchor | Art and optional living layers | Narrative guard |
|---|---|---|---|---|
| KL-01-01 | `Unang naramdaman ni Phan ang paggalaw` | `dahan-dahang humaba ang guhit` | Lunawen storehouse, tied stalks, grain jar rolling, hairline floor crack; subtle dust and lantern movement | No giant root or child revealed yet |
| KL-01-02 | `Nakatayo sa bungad ang kanyang ina` | `may lumilitaw na maputlang liwanag.` | Mother, Tali, Phan, tilting homestead and grey massive root with pale green veins; slow debris and luminous pulses | Keep family faces/wardrobe consistent; no visible father |
| KL-01-03 | `Sa pagitan ng dalawang gumuhong bakod` | `Sa pagitan ng mga ito ay may liwanag` | Child gripping fissure edge, Phan reaching, tangled underground roots and light; restrained depth haze | Child must look ordinary; do not hint at missing shadow |
| KL-01-04 | `Hinila ni Phan ang lubid.` | `Nawala rin ang tinig ng kanyang ama.` | Phan securing rope, child rising, root at ankle, collapsing home; light pulses fade after rescue | Father is a voice only, never a visible ghost; do not expose hidden creature form |
| KL-01-05 | `Ngunit pagdaan nila sa tabi ng isang nakatumbang sisidlang puno ng tubig` | `WAKAS NG KABANATA 1` | Moonlight, water reflection of child, **no child's shadow on ground**, ruined house beyond; subtle water ripples | Display ONLY once reader reaches final reveal; no thumbnails, preload-visible previews, chapter cover spoilers |

## Design/engineering acceptance

1. Art must be original or properly licensed, visually coherent across all five scenes; owner approval per image and per animation layer. No invented final art.
2. Light motion: atmospheric dust/rain only when weather in text permits; root glow and water ripples as scene-specific layers. **Do not add rain to Chapter 1 as a canonical fact**: Chapter 1 describes a moonlit night and wind, not rainfall. Rain may be used in other scenes where the prose supports it.
3. Animate only the visible scene; off-screen/background, Reduce Motion, battery saver, weak connection, or member toggle => static fallback. Never block text reading on media.
4. Ambient and music remain separate opt-in channels, silent until licensed/original assets approved; DZAS/PTT takes priority. No oscillator.
5. Reader must ingest full canonical manuscript rather than the old preview; the presence of markdown files alone does not mean runtime integration.
6. Admin must verify word-for-word text, exact scene anchors, media licensing, final mobile layout and animation performance before approval.
7. Verify V28 actually live, reconcile cumulative production baseline, run cloud CI Jest and low-end Android tests, secure SQL/RLS and points idempotency checks, then freeze RC; no production OTA or migration before all gates.
8. 100% cloud-only. No writes/downloads/builds/caches on the owner's PC.
