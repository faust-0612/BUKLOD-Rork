# Kabihasnang Ligaw R5 — cinematic design specification

Status: provisional review. This is not a frozen release candidate and not an owner art approval.

## What this spec is

The reader shell follows the approved creative contract: cinematic, readable Filipino prose layout, a permanent featured story on the Community Wall, and scene-matched media that cannot publish until the owner reviews it. No separate R3/R4 visual-direction file is in the repository. The earlier wall card and three-paragraph reader are provisional prototypes, not final asset approval.

Palette in the shell reuses the provisional prototype colors already in the R5 card (`#101a20`, `#142a28`, `#e5c891`, `#f6dfb0`, `#f1ece3`). Those colors are not an approved final illustration system.

## Canon that the interface may show

- Author: Likha ni Faustino Jr. M. Gabut
- Season 1 proposed title: Ang Lupang Hindi Namamatay
- Protagonist: Phan
- Order of protagonists: Phan, Quin, Van, Christian, Lhen
- Published later cast, when those seasons exist: Ace, Elesur, Mitch, Niel, Angel, Vhen, Trudice
- Jawo/Javvo stays an owner spelling blocker and is not shown to members
- The one-mind allegory is not explained in member copy, glossary, or manuscripts

## Manuscript

Panimula and Kabanata 1 are the canonical files `content/kabihasnang-ligaw/panimula.md` and `content/kabihasnang-ligaw/kabanata-01.md`. The reader and the admin review load that text. Members still do not see it: the episodes stay draft, art and audio are unapproved, and the server returns an empty chapter until release. Episodes 2–30 are outline labels only.

`release/BUKLOD_ENGINEERING_CHARTER.md` was requested and is not on this branch or on `origin/main`.

## Reader shell

- Full-screen library and chapter view, max measure about 760px, tighter padding under 420px width
- Chapter kicker, title, author credit, body size starting at 19 with line height about 1.65
- Member text-size controls, plus the platform text scaler
- Glossary entry with no invented definitions
- Optional music and ambient controls, separate, no autoplay
- Image slot that renders nothing until a real approved URI exists
- Retry, saved preferences, and a plain weak-connection message
- Cosmetic Lakbay progress, separate from BUKLOD Points

## Living illustrations

Chapter 1 living layers are bound to paragraph spans from the canonical text and stay unapproved. Rain is forbidden: the chapter is moonlit and windy, and rainfall is not in the prose. Leaf, dust, root-light, and closing-reveal water motion pause off-screen, in the background, with Reduce Motion, with the member motion switch off, in battery-saving mode, and on a weak connection. The closing shadow and the duplicated voice are not shown before that paragraph. The admin motion test is a labeled abstract drift, not rainfall and not a story scene. There is no video layer.

## Audio and DZAS

Music and ambient assets are missing. Controls stay silent. There is no oscillator. If a future approved file exists, playback still waits for a member tap, and both channels go quiet while 702 DZAS is already playing or while PTT is transmitting or receiving. They resume only when that other audio has stopped and the member had already asked to play. A missing or failed sound does not block reading.

## Admin review

Story Management is a row inside the existing Admin Panel. Server functions require `buklod_is_system_admin()`. Approve, schedule, pause, resume, and the emergency switch write an append-only audit. Approve refuses incomplete prose, unbound storyboard rows, and any required asset that is not owner-approved. Schedule accepts a Manila calendar date and stores 06:00 Asia/Manila. The handset clock is not the unlock.

## Asset gate

See `docs/kabihasnang-ligaw-r5-media-storyboard-manifest.json`, generated from `src/lib/kabihasnang-ligaw/catalog.ts`. Owner image approval remains pending. No illustration `approved` flag is true.
