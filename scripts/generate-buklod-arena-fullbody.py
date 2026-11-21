#!/usr/bin/env python3
"""BUKLOD Arena, source-owned full-body procedural pose animation.

Zero-cost Python/Pillow/OpenCV tool. The generated sprites retain each character's
original full-body drawing from the repo and produce 8-frame transparent WebP
idle/walk/attack/skill clips. NOT hand-drawn skeletal/360° rigs. Do not relabel
as artist-approved fidelity without visual inspection and device QA.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ART_REGISTRY = ROOT / "src/features/games/empire/arenaVisualBaseline.ts"
INGEST = ROOT / "scripts/ingest-buklod-visual-baseline.mjs"
CHARACTERS = (
    "phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
    "jawo", "mitch", "niel", "angel", "vhen", "trudice"
)
POSES = ("idle", "walk", "attack", "skill")
SIZE = (256, 384)
FRAMES = 8
DURATION_MS = 110
SEGMENTATION_SESSION = None


def canonical_images():
    source = ART_REGISTRY.read_text(encoding="utf8")
    found = {}
    for name, relative in re.findall(
        r"^\s*([a-z]+):\s*require\(['\"]\.\./\.\./\.\./\.\./(assets/[^'\"]+\.(?:jpg|png|webp))['\"]\)",
        source, re.MULTILINE,
    ):
        if name in CHARACTERS:
            found[name] = ROOT / relative
    if len(found) != len(CHARACTERS):
        raise RuntimeError("Missing canonical character source image")
    return found


def center_source(path):
    with Image.open(path) as original:
        art = ImageOps.exif_transpose(original).convert("RGB")
    width, height = art.size
    # The five core-character progression images are horizontal multi-pose
    # strips. Each ~0.48*image-height cell contains a FULL-BODY character.
    if width > height * 2.1:
        cell = round(height * 0.48)
        art = art.crop((0, 0, min(width, cell), height))
    elif width > height * 1.2:
        art = art.crop((0, 0, min(width, round(height * .52)), height))
    return art


def matte_fullbody(art: Image.Image) -> Image.Image:
    """Open-source person mask; rejects clipped head/legs instead of shipping them.

    U²-Net small via rembg is CPU-only and licensed for no-cost processing.
    We preserve the *actual canonical BUKLOD illustration*, not a replacement.
    """
    from rembg import new_session, remove
    global SEGMENTATION_SESSION
    if SEGMENTATION_SESSION is None:
        SEGMENTATION_SESSION = new_session("u2netp", providers=["CPUExecutionProvider"])
    crop = ImageOps.contain(art, (240, 360), Image.Resampling.LANCZOS)
    try:
        result = remove(crop, session=SEGMENTATION_SESSION, post_process_mask=True).convert("RGBA")
    except Exception as exc:
        raise RuntimeError("Reliable foreground matting unavailable") from exc
    alpha = np.asarray(result.getchannel("A"))
    visible = alpha > 80
    if int(visible.sum()) < int(crop.width * crop.height * .065):
        raise RuntimeError("No credible full-body foreground")
    ys, xs = np.where(visible)
    top = int(ys.min())
    bottom = int(ys.max())
    visible_height = bottom - top
    # Image's person must occupy substantial height; no chopped heads or legs.
    if visible_height < int(crop.height * .61) or top > int(crop.height * .23) or bottom < int(crop.height * .76):
        raise RuntimeError(
            f"Clipped full-body source: top={top}, bottom={bottom}, height={crop.height}; manual art refinement required"
        )
    bbox = result.getbbox()
    if not bbox:
        raise RuntimeError("Transparent portrait after segmentation")
    return result.crop(bbox)


def transform_piece(base: Image.Image, angle: float, dx: float, dy: float):
    result = base.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
    moved = Image.new("RGBA", base.size)
    moved.alpha_composite(result, (round(dx), round(dy)))
    return moved


def make_clip(fullbody: Image.Image, pose: str):
    art = ImageOps.contain(fullbody, (166, 313), Image.Resampling.LANCZOS)
    frames = []
    x_base = (SIZE[0] - art.width) // 2
    y_base = SIZE[1] - art.height - 24
    breakline = round(art.height * .62)

    # Separate overlapping upper/lower layers with feathered seam; transforms
    # create original motion rather than cycling costumes or faking new art.
    torso = art.copy()
    legs = art.copy()
    top_mask = Image.new("L", art.size, 0)
    bottom_mask = Image.new("L", art.size, 0)
    t = np.zeros((art.height,), np.uint8)
    b = np.zeros((art.height,), np.uint8)
    for y in range(art.height):
        u = min(1, max(0, (y - breakline + 15) / 30))
        t[y] = round((1 - u) * 255)
        b[y] = round(u * 255)
    t_np = np.repeat(t[:, None], art.width, axis=1)
    b_np = np.repeat(b[:, None], art.width, axis=1)
    a = np.array(art.getchannel("A"), dtype=np.uint16)
    torso.putalpha(Image.fromarray((a * t_np // 255).astype(np.uint8), "L"))
    legs.putalpha(Image.fromarray((a * b_np // 255).astype(np.uint8), "L"))

    for idx in range(FRAMES):
        phase = idx * 2 * math.pi / FRAMES
        sine = math.sin(phase)
        output = Image.new("RGBA", SIZE)
        gfx = ImageDraw.Draw(output, "RGBA")
        # Feet shadow and dynamic grounding sell full-body scale in top-down art.
        shadow_w = max(28, int(art.width * .35))
        gfx.ellipse((SIZE[0]/2-shadow_w, SIZE[1]-24,
                     SIZE[0]/2+shadow_w, SIZE[1]-12),
                    fill=(2, 15, 19, 65))
        if pose == "walk":
            bob, spin_upper, spin_lower = abs(sine) * -3, sine * 3.2, -sine * 4.7
            shift_x, leg_x = sine * 2.0, -sine * 3.0
        elif pose == "attack":
            power = math.sin(math.pi * idx / (FRAMES-1))
            bob, spin_upper, spin_lower = -power * 5, -12 * power + sine, 2 * power
            shift_x, leg_x = 3 * power, 0
            radius = 58
            gfx.arc((SIZE[0]/2-radius, SIZE[1]*.33-radius, SIZE[0]/2+radius,
                     SIZE[1]*.33+radius), start=210-idx*14, end=260-idx*14,
                    fill=(254, 224, 132, int(220 * power)), width=5)
        elif pose == "skill":
            power = .5 + .5 * sine
            bob, spin_upper, spin_lower = -4 * power, sine * 4.2, -sine * 2
            shift_x, leg_x = 0, 0
            rr = 38 + idx * 4
            gfx.ellipse((SIZE[0]/2-rr, SIZE[1]*.5-rr,
                         SIZE[0]/2+rr, SIZE[1]*.5+rr), outline=(112, 238, 230, 120), width=3)
            for p in range(4):
                a = phase + p * math.pi / 2
                px = SIZE[0]/2 + math.cos(a) * rr
                py = SIZE[1]*.48 + math.sin(a) * rr
                gfx.ellipse((px-3, py-3, px+3, py+3), fill=(255, 224, 160, 190))
        else:
            bob, spin_upper, spin_lower = -sine * 2, sine * 1.6, -sine * 1.1
            shift_x, leg_x = sine, 0

        lower = transform_piece(legs, spin_lower, leg_x, bob*.5)
        upper = transform_piece(torso, spin_upper, shift_x, bob)
        output.alpha_composite(lower, (x_base, y_base))
        output.alpha_composite(upper, (x_base, y_base))
        frames.append(output)

    return frames


def main():
    canonical = canonical_images()
    with tempfile.TemporaryDirectory(prefix="buklod-body-rig-") as folder:
        tmp = Path(folder)
        for character, path in canonical.items():
            fullbody = matte_fullbody(center_source(path))
            if fullbody.width < 25 or fullbody.height < 60:
                raise RuntimeError("Full-body extraction too small for " + character)
            for pose in POSES:
                frames = make_clip(fullbody, pose)
                output = tmp / (character + "_" + pose + ".webp")
                frames[0].save(output, "WEBP", save_all=True, append_images=frames[1:],
                               loop=0, duration=DURATION_MS, quality=87, method=4)
                with Image.open(output) as proof:
                    if not proof.is_animated or proof.n_frames != FRAMES:
                        raise RuntimeError("Invalid animation frames: " + output.name)
                    if proof.size != SIZE:
                        raise RuntimeError("Wrong clip dimensions")
                done = subprocess.run(
                    ["node", str(INGEST), "--source", str(output),
                     "--kind", "fullbody", "--id", character + "_" + pose],
                    cwd=ROOT, text=True, capture_output=True, timeout=20, check=True
                )
                receipt = json.loads(done.stdout)
                if receipt["registered"] != "fullbody:" + character + "_" + pose:
                    raise RuntimeError("Untrusted registry output")
                print(json.dumps({"key": receipt["registered"], "bytes": receipt["bytes"],
                                  "sha256": receipt["sha256"]}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Full-body Arena pose generation failed: " + str(error), file=sys.stderr)
        sys.exit(1)
