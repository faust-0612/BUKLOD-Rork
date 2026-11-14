# BUKLOD Kingdom Premium Audio (staging only)

Chosen source: Crown of Embers (Orchestral Version), by gtherond.
Original: https://github.com/gtherond/crown-of-embers
License: CC0-1.0 (see upstream LICENSE). Source pinned to commit 06c4583f2ac7f36ddd5eb244e567e7caa0cfbf83.

Cinematic recorded effects: kit from Barty-Bart motion-graphics.
Original: https://github.com/Barty-Bart/motion-graphics/tree/main/skills/sound-effects/sfx/kit
License: CC0-1.0; individual original author credits and source links: https://github.com/Barty-Bart/motion-graphics/blob/main/skills/sound-effects/LICENSES.md
Pinned to commit 3d83d987d658601d8a1269eb691622bdcd427335.

The vendoring tool preserves SHA-256 of each upstream audio download and final encoded MP3 in assets.json. All audio is bundled locally for offline Expo playback. No CDN playback, paid audio API, or new native dependency.
Original orchestra track is excerpted as a circular 52-second music loop with five-second crossfade to avoid clipped transitions. Game event cues remain at original pitch and bounded volume.

Build: python3 scripts/vendor-kingdom-premium-audio.py (requires Python 3, ffmpeg, ffprobe).
This integration is staging-only, and must pass validation before release; production unchanged.
