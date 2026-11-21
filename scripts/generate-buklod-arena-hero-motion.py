#!/usr/bin/env python3
"""DEV-only animation builder: source BUKLOD hero art -> real animated WebP bytes.

This is *not* full-body rigging. It is a faithful portrait/motion baseline
whose bytes are committed and automatically rendered inside BUKLOD Main.
Uses existing 13 licensed-in-repository portraits. No AI host, paid asset,
production database, separate game, or user Library upload is required.
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/features/games/empire/arenaVisualBaseline.ts"
INGEST = ROOT / "scripts/ingest-buklod-visual-baseline.mjs"
CHARACTERS = (
    "phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
    "jawo", "mitch", "niel", "angel", "vhen", "trudice",
)
FRAME_SIZE = 128
FRAMES = 12
FPS_MS = 105
# Color accents only. Every character retains its *own* canonical artwork.
ACCENTS = ("#8debe3", "#ebcb7a", "#8ac7fe", "#b8d9ff", "#edc5ef")


def portrait_paths():
    text = SOURCE.read_text(encoding="utf-8")
    found = {}
    for cid, path in re.findall(
        r"^\s*([a-z]+):\s*require\(['\"]\.\./\.\./\.\./\.\./(assets/[^'\"]+\.(?:jpg|png|webp))['\"]\)",
        text, re.MULTILINE,
    ):
        if cid in CHARACTERS:
            found[cid] = ROOT / path
    if set(found) != set(CHARACTERS):
        raise RuntimeError("Incomplete canonical character art catalog")
    for cid, path in found.items():
        if not path.is_file() or path.stat().st_size < 4096:
            raise RuntimeError("Missing genuine source art: " + cid)
    return found


def make_frame(source: Image.Image, frame_index: int, accent: str) -> Image.Image:
    phase = frame_index * 2 * math.pi / FRAMES
    center = FRAME_SIZE / 2
    canvas = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    # Multi-layer soft rim light and particle accents in transparent 2.5D space.
    halo = Image.new("RGBA", canvas.size)
    h = ImageDraw.Draw(halo)
    h.ellipse((9, 9, 119, 119), outline=(96, 226, 236, 105), width=7)
    h.ellipse((15, 15, 113, 113), fill=(5, 45, 62, 95))
    halo = halo.filter(ImageFilter.GaussianBlur(radius=9))
    canvas.alpha_composite(halo)

    bob = math.sin(phase) * 2.6
    tilt = math.sin(phase + .35) * 1.6
    scale = 1 + .017 * math.sin(phase)
    side = int(20 + math.sin(phase) * 0.5)
    diameter = max(65, round(88 * scale))
    face = ImageOps.fit(source, (diameter, diameter), method=Image.Resampling.LANCZOS,
                        centering=(0.5, 0.39))
    face = face.rotate(tilt, resample=Image.Resampling.BICUBIC, expand=False)
    mask = Image.new("L", face.size)
    ImageDraw.Draw(mask).ellipse((0, 0, diameter - 1, diameter - 1), fill=255)
    face.putalpha(mask)
    base = (FRAME_SIZE - diameter) // 2
    canvas.alpha_composite(face, (base, round(base + bob)))

    d = ImageDraw.Draw(canvas)
    circle = (base - 1, base - 1 + bob, base + diameter + 1, base + diameter + 1 + bob)
    d.arc(circle, 20 + math.degrees(phase), 285 + math.degrees(phase),
          fill=(244, 212, 139, 220), width=3)
    d.arc(circle, 190 + math.degrees(phase) / 4, 245 + math.degrees(phase) / 4,
          fill=(135, 231, 247, 230), width=2)
    # A few deliberate glints suggest energy without replacing real player art.
    for k in range(3):
        angle = phase * .8 + k * 2 * math.pi / 3
        x = center + math.cos(angle) * 53
        y = center + math.sin(angle) * 53
        r = 1.7 + (math.sin(angle * 2) + 1) * .55
        d.ellipse((x-r, y-r, x+r, y+r), fill=(248, 233, 178, 160))
    return canvas


def create_animation(source: Path, destination: Path, accent: str):
    with Image.open(source) as photo:
        art = ImageOps.exif_transpose(photo).convert("RGB")
        sequence = [make_frame(art, frame, accent) for frame in range(FRAMES)]
    sequence[0].save(
        destination, "WEBP", save_all=True, append_images=sequence[1:],
        duration=FPS_MS, loop=0, quality=83, method=5,
    )
    with Image.open(destination) as check:
        if not getattr(check, "is_animated", False) or check.n_frames != FRAMES:
            raise RuntimeError("Animated-WebP encoder failed for " + source.name)
        if check.size != (FRAME_SIZE, FRAME_SIZE):
            raise RuntimeError("Incorrect WebP dimensions")


def main():
    portraits = portrait_paths()
    with tempfile.TemporaryDirectory(prefix="buklod-hero-motion-") as tmp:
        for i, cid in enumerate(CHARACTERS):
            file = Path(tmp) / (cid + ".webp")
            create_animation(portraits[cid], file, ACCENTS[i % len(ACCENTS)])
            child = subprocess.run(
                ["node", str(INGEST), "--source", str(file), "--kind", "sprite", "--id", cid],
                cwd=str(ROOT), capture_output=True, text=True, timeout=25, check=True,
            )
            receipt = json.loads(child.stdout.strip())
            if receipt["registered"] != "sprite:" + cid:
                raise RuntimeError("Unexpected registry receipt for " + cid)
            print(json.dumps({"id": cid, "file": receipt["file"], "bytes": receipt["bytes"],
                              "sha256": receipt["sha256"]}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("BUKLOD hero motion baseline failed: " + str(error), file=sys.stderr)
        sys.exit(1)
