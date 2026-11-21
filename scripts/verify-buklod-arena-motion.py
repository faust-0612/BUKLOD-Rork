#!/usr/bin/env python3
"""Validate REAL BUKLOD fullbody WebP motion assets, not just ANIM file signatures.

Content checks: 13 authenticated hero IDs, four poses each, 8 decoded frames,
visible full-body foreground, actual motion (not duplicate stills), distinct
attack/skill poses, verified SHA-256 and bounded dimensions.

This verifies source asset integrity/motion, NOT artist-approved visual style,
frame rates on physical Android devices, or server-authoritative gameplay.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets/season2/arena/generated-manifest.json"
HEROES = (
    "phan", "quin", "van", "christian", "lhen", "ace", "ellusur",
    "jawo", "mitch", "niel", "angel", "vhen", "trudice",
)
POSES = ("idle", "walk", "attack", "skill")
SIZE = (256, 384)
MIN_MOTION_SUM = 2000


def assert_asset(entry: dict, hero: str, pose: str):
    path = ROOT / entry["file"]
    if not path.is_file():
        raise AssertionError(f"Missing source-owned animation: {hero}/{pose}")
    binary = path.read_bytes()
    if len(binary) != entry["bytes"]:
        raise AssertionError(f"Asset size drift: {hero}/{pose}")
    if hashlib.sha256(binary).hexdigest() != entry["sha256"]:
        raise AssertionError(f"SHA-256 mismatch: {hero}/{pose}")
    frames = []
    with Image.open(path) as movie:
        if movie.format != "WEBP" or movie.size != SIZE:
            raise AssertionError(f"Wrong decoded WebP dimensions: {hero}/{pose}")
        if not getattr(movie, "is_animated", False) or movie.n_frames != 8:
            raise AssertionError(f"Not a real eight-frame animation: {hero}/{pose}")
        for index in range(movie.n_frames):
            movie.seek(index)
            delay = movie.info.get("duration", 0)
            if not 65 <= delay <= 250:
                raise AssertionError(f"Unsafe animation frame duration {hero}/{pose}: {delay}")
            frame = movie.convert("RGBA").copy()
            if frame.getchannel("A").getbbox() is None:
                raise AssertionError(f"Empty transparent frame: {hero}/{pose}/{index}")
            alpha = frame.getchannel("A").point(lambda v: 255 if v >= 50 else 0)
            box = alpha.getbbox()
            if box is None or box[3] - box[1] < 190:
                raise AssertionError(f"Full-body silhouette clipped: {hero}/{pose}/{index}")
            frames.append(frame)

    transitions = 0
    for previous, current in zip(frames, frames[1:]):
        diff = ImageChops.difference(previous.convert("RGB"), current.convert("RGB"))
        strength = sum(ImageStat.Stat(diff).sum)
        if strength > MIN_MOTION_SUM:
            transitions += 1
    if transitions < 3:
        raise AssertionError(f"Mostly duplicated motion frames: {hero}/{pose}: {transitions}")
    return frames


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    assets = manifest.get("assets", [])
    lookup = {entry["key"]: entry for entry in assets}
    if len(lookup) != len(assets):
        raise AssertionError("Duplicate generated-asset registration")
    verified = 0
    for hero in HEROES:
        clips = {}
        for pose in POSES:
            key = f"fullbody:{hero}_{pose}"
            if key not in lookup:
                raise AssertionError(f"Missing {key}")
            clips[pose] = assert_asset(lookup[key], hero, pose)
            verified += 1
        # At the action peak, the active attack/skill must differ materially
        # from idle: simply replaying a static portrait in all four states fails.
        for action in ("attack", "skill"):
            diff = ImageChops.difference(clips[action][4].convert("RGB"), clips["idle"][4].convert("RGB"))
            if sum(ImageStat.Stat(diff).sum) <= MIN_MOTION_SUM:
                raise AssertionError(f"Action is visually indistinguishable: {hero}/{action}")
    print(json.dumps({
        "result": "source_motion_integrity_verified",
        "characters": len(HEROES), "fullbody_clips": verified,
        "frames_total": verified * 8,
        "pose_states": list(POSES),
        "approved_sample_fidelity": "NOT_VERIFIED",
        "android_runtime": "NOT_VERIFIED",
    }))


if __name__ == "__main__":
    main()
