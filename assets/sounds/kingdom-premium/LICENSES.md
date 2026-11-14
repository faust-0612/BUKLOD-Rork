# BUKLOD Kingdom premium staging audio — CC0 provenance

These are **real, authored music recordings** rather than short synthesized notification loops.
Only the listed exact-source CC0 files are bundled. No AI model training is permitted
on separately licensed third-party files; these CC0 assets are used solely for in-app playback.

## Music — Creative Commons Zero (CC0 1.0)
- `kingdom-theme.ogg` — "Treasure Hunter", **TAD (Tad Miller)**, original: https://opengameart.org/content/treasure-hunter
- `kingdom-village.ogg` — "Medieval: Rejoicing", **RandomMind**, original: https://opengameart.org/content/medieval-rejoicing
- `kingdom-great-hall.ogg` — "Medieval: The Old Tower Inn", **RandomMind**, original: https://opengameart.org/content/medieval-the-old-tower-inn

Original redistributed/converted OGG files from the publicly maintained Stendhal game:
https://github.com/arianne/stendhal/tree/95f3971e9974d74b3e2cb4ad877400309fb1284e/app/android/client/src/main/res/raw

Stendhal's attribution/rights ledger, including CC0 for all three:
https://github.com/arianne/stendhal/blob/95f3971e9974d74b3e2cb4ad877400309fb1284e/doc/sources/audio-music.txt

## Game interaction sound effects — Creative Commons Zero (CC0 1.0)
Source: **Kenney / Kenney Interface Sounds 1.0**:
https://kenney.nl/assets/interface-sounds
https://github.com/Calinou/kenney-interface-sounds/tree/4596a49eaf5a533948d49a47467f606bcdea70ff

Files in this folder: `ui-soft.wav`, `collect-crystal.wav`, `impact-wood.wav`,
`victory.wav`, `failure.wav`, `unlock.wav`, `enter.wav`, `coins.wav`,
and `victory-alt.wav`. The source repository includes Kenney's CC0 LICENSE.txt.

Each source is pinned to a commit and Git blob SHA. The vendoring script rejects
unknown/mismatched content, and a test checks every audio header, size and Git hash.
The resulting recordings are bundled for offline app playback and never streamed
from a transient Rork preview URL, Supabase, or a paid audio API.

Creative Commons Zero: https://creativecommons.org/publicdomain/zero/1.0/
