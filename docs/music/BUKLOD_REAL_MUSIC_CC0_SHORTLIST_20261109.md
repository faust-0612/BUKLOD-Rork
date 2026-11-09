# BUKLOD — Real Music / SFX Source Shortlist (2026-11-09)

## Status: DEV-only sourcing manifest; **no audio ingested or published**

This shortlist responds to the owner's rejection of sine-wave tones and request for actual existing music used in birthday, social-media, celebrations and funny clips. The entries below are **recorded music**, not generated tone packs. Each linked creator page currently labels its downloadable tracks **CC0**; this is a source-asserted license, not an independent chain-of-title guarantee. Preserve title, author, source URL and a copy of the license claim alongside any eventual import.

Do **not** interpret absence of YouTube/TikTok warnings, a BUKLOD admin toggle, or viral popularity as recording/composition permission. Only ingest a track after its license applies to the exact audio file and author has the necessary rights. Verify the actual download/media bytes and playback, duplicate hashes, and commercial sublicensing rights. The existing Supabase `buklod_music_library` stores tracks by `audio_path`; no files have been uploaded by this manifest. Do not insert URL-only placeholders into production.

| BUKLOD mood / category | Existing audio source | Creator | Declared license |
| --- | --- | --- | --- |
| Birthday party / upbeat | [Happy Loop](https://opengameart.org/content/happy-loop) | wipics | CC0 |
| Birthday / celebration | [Happy Beat](https://opengameart.org/content/happy-beat) | burabotti | CC0 |
| Pinoy comedy-style light backing (not a Filipino recording) | [Banana Track](https://opengameart.org/content/banana-track) | skrjablin | CC0 |
| Dance / Reels | [Shine Blitz](https://opengameart.org/content/shine-blitz) | zesona | CC0 |
| Synthpop / Reels | [Happier Tune](https://opengameart.org/content/happier-tune) | Gena Sealov | CC0 |
| Synthpop / stories | [Bright Stars](https://opengameart.org/content/bright-stars) | Gena Sealov | CC0 |
| Party EDM | [Joyfully](https://opengameart.org/content/joyfully) | MintoDog | CC0 |
| Dance pack — five separate tracks | [Dance Music Pack](https://opengameart.org/content/dance-music-pack) | Umplix | CC0 |
| Pop pack — four separate tracks | [Pop Music](https://opengameart.org/content/pop-music) | Pro Sensory / Alex McCulloch | CC0 |
| Celebration / chill | [Happy](https://opengameart.org/content/happy) | Pro Sensory / Alex McCulloch | CC0 |
| Upbeat BGM | [Upbeat Song](https://opengameart.org/content/upbeat-song) | Ruhinre | CC0 |
| Music montage | [Our Expanse](https://opengameart.org/content/our-expanse) | Bobjt | CC0 |
| Upbeat instrumental | [Scaling Up](https://opengameart.org/content/scaling-up) | Ruskerdax | CC0 |

### Catalog metadata and acceptance
- For each actual audio track, keep: **source page**, **creator**, **file name**, **download date**, **license** and its snapshot, **content SHA-256**, **duration**, **codec**, **app category**, **review state**.
- Categories already exist in BUKLOD: `christian`, `love`, `instrumental`, `sound_clips`, `ambience`, `others`. No schema or enum changes needed just to import these tracks.
- On import, use the existing **System Admin-only** `src/app/admin/music-library.tsx` uploader, which uploads actual files and inserts metadata only following successful storage upload.
- For real birthday singing or Philippine viral music, seek creator permission/license that covers **a BUKLOD-hosted reusable music picker**, not merely reposting on YouTube. The currently listed party instrumentals are **not** the traditional Happy Birthday vocal recording.
- No production catalog rows, remote audio keys, storage objects, OTA or web deploy are changed by this source manifest.

### Existing platform distinctions
- [OpenGameArt licensing FAQ](https://opengameart.org/content/faq): CC0 permits commercial copying and redistribution, subject to the creator having valid rights.
- [Freesound licensing FAQ](https://freesound.org/help/faq/): CC0 and CC-BY available per individual file, verify individual attribution and original provenance.
- [Mixkit SFX Free License](https://mixkit.co/license/modal/sfxFree/): commercial end-product usage but **no redistribution on its own in a tool or template**.
- [Pixabay content license](https://pixabay.com/service/license-summary/): commercial end-product usage but **no standalone redistribution**. Do not blindly mirror its audio into a BUKLOD stock catalog.

### Next safe operational step
Fetch actual audio through an authorized download session, inspect it, verify real melodic/instrumental audio and metadata, store approved bytes in the existing `buklod-music-library` bucket through the authenticated System Admin flow, and read back catalog and preview playback. Until then this is **sourced only, not imported**.
