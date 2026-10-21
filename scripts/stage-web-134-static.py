"""Copy the approved web icon and local Leaflet engine into an Expo web export."""
import hashlib
import pathlib
import re
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


def icon_token() -> str:
    return hashlib.sha256((ROOT / "public" / "buklod-192.png").read_bytes()).hexdigest()[:12]


def stamp_html(html: str, token: str) -> str:
    html = re.sub(
        r'<link rel="icon" href="/favicon\.ico(?:\?[^"]*)?"\s*/?>',
        f'<link rel="icon" type="image/png" sizes="192x192" href="/buklod-192.png?v={token}"/>',
        html,
    )
    return re.sub(
        r'href="/(buklod-(?:192|512)\.png)(?:\?[^"]*)?"',
        rf'href="/\1?v={token}"',
        html,
    )


def stamp_manifest(text: str, token: str) -> str:
    return re.sub(
        r'"/(buklod-(?:192|512)\.png)(?:\?[^"]*)?"',
        rf'"/\1?v={token}"',
        text,
    )


def stage(dist: pathlib.Path) -> str:
    token = icon_token()
    vendor_dst = dist / "vendor"
    if vendor_dst.exists():
        shutil.rmtree(vendor_dst)
    shutil.copytree(ROOT / "public" / "vendor", vendor_dst)
    for name in ("buklod-192.png", "buklod-512.png", "manifest.json", "app-ads.txt"):
        shutil.copy2(ROOT / "public" / name, dist / name)

    index = dist / "index.html"
    if index.is_file():
        index.write_text(stamp_html(index.read_text(), token), encoding="utf-8")

    manifest = dist / "manifest.json"
    if manifest.is_file():
        manifest.write_text(stamp_manifest(manifest.read_text(), token), encoding="utf-8")

    print("staged-web-static", token)
    return token


if __name__ == "__main__":
    stage(pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "dist"))
