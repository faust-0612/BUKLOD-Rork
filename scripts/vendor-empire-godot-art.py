#!/usr/bin/env python3
"""One-time DEV vendoring of user's already approved animated WebP art.

Godot native cannot decode WebP ANIM directly, so this deterministically
creates 4x2 PNG atlases of eight sampled source frames. This is source-time
conversion, never run as an APK/EAS native build or by installed clients.
"""
import json
import re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
APPROVED = (ROOT / "assets/season2/arena/generated").resolve()
MANIFEST = ROOT / "src/features/games/empire/arenaGeneratedAssets.ts"
DEST = ROOT / "godot/empire-arena/art"
CONTENTS = MANIFEST.read_text(encoding="utf8")
PATTERN = re.compile(r"'(fullbody|scene|sprite):([^']+)':\s*require\('([^']+)'\)")
counts = {"fullbody": 0, "sprite": 0, "scene": 0}
metadata = {}
for group, slug, src in PATTERN.findall(CONTENTS):
    raw = (MANIFEST.parent / src).resolve()
    if not raw.is_relative_to(APPROVED) or re.fullmatch(r"[a-z0-9_]+", slug) is None:
        raise RuntimeError(f"Unapproved visual source {src}")
    counts[group] += 1
    if group == "scene":
        if raw.suffix != ".png":
            raise RuntimeError(f"Wrong terrain image encoding: {raw.name}")
        continue
    if raw.suffix != ".webp":
        raise RuntimeError(f"Wrong hero image format: {raw.name}")
    with Image.open(raw) as animation:
        if not animation.n_frames:
            raise RuntimeError(f"Missing frames: {raw.name}")
        count = int(animation.n_frames)
        w, h = animation.size
        if w <= 0 or h <= 0 or w > 1024 or h > 1024:
            raise RuntimeError(f"Hero art exceeds safe atlas dimensions: {raw.name}")
        if group == "fullbody":
            sheet = Image.new("RGBA", (4 * w, 2 * h), (0, 0, 0, 0))
            for index in range(8):
                frame_idx = min(count - 1, round(index * (count - 1) / 7))
                animation.seek(frame_idx)
                frame = animation.convert("RGBA")
                sheet.alpha_composite(frame, ((index % 4) * w, (index // 4) * h))
            frames = 8
            rows, cols = 2, 4
        else:
            animation.seek(0)
            sheet = animation.convert("RGBA")
            frames = 1
            rows, cols = 1, 1
    dest = DEST / group / f"{slug}.png"
    dest.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(dest, format="PNG", optimize=True, compress_level=9)
    if not dest.is_file() or dest.stat().st_size < 100:
        raise RuntimeError("Missing transcoded art: " + str(dest))
    metadata[f"{group}/{slug}"] = {
        "rows": rows, "columns": cols, "frames": frames,
        "frame_width": w, "frame_height": h, "frame_ms": 125,
        "source": raw.relative_to(ROOT).as_posix()
    }

if counts != {"fullbody": 52, "sprite": 13, "scene": 3} or len(metadata) != 65:
    raise RuntimeError(f"Incomplete native art conversion: {counts}")
manifest_path = DEST / "art_manifest.json"
manifest_path.write_text(json.dumps({"schema": 1, "assets": metadata}, sort_keys=True, indent=2) + "\n",
                         encoding="utf8")
print(json.dumps({"result": "BUKLOD_NATIVE_ART_68_CANONICAL", "source": "previously approved BUKLOD art",
                  "converted": 65, "referenced_scene_images": 3, "manifest": str(manifest_path)}))
