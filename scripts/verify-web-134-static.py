"""Check a web export for the V28 version marker and exact app-ads.txt."""
import hashlib
import json
import pathlib
import re
import sys
import urllib.request

EXPECTED = b"google.com, pub-3448515158880100, DIRECT, f08c47fec0942fa0"
LIVE = "https://buklod.expo.app/"
ROOT = pathlib.Path(__file__).resolve().parents[1]
OLD_WEB_ICONS = {
    "buklod-192.png": "96eb445f0326acc2c81a12dfc4b2057c6a3c814f45bc428251e1251d453a2c48",
    "buklod-512.png": "9183800b0e63def848165f6732266e1ca00c696782b34b5c17ef5068a6ab030b",
}


def verify(dist: pathlib.Path) -> None:
    seller = dist / "app-ads.txt"
    body = seller.read_bytes()
    if body != EXPECTED:
        raise SystemExit(f"app-ads.txt mismatch bytes={len(body)} sha256={hashlib.sha256(body).hexdigest()}")
    index = dist / "index.html"
    if not index.is_file() or index.stat().st_size == 0:
        raise SystemExit("dist/index.html missing")
    blob = index.read_bytes()
    js_root = dist / "_expo" / "static" / "js"
    if js_root.is_dir():
        for path in js_root.rglob("*.js"):
            blob += path.read_bytes()
    if b"1.3.4" not in blob:
        raise SystemExit("exported web assets do not contain version 1.3.4")

    token = hashlib.sha256((ROOT / "public" / "buklod-192.png").read_bytes()).hexdigest()[:12]
    html = index.read_text(encoding="utf-8")
    if f"/buklod-192.png?v={token}" not in html:
        raise SystemExit("web icon link is not cache-busted to the canonical mark")
    if 'href="/favicon.ico"' in html:
        raise SystemExit("web icon still points at unversioned favicon.ico")

    for name, old_hash in OLD_WEB_ICONS.items():
        body = (dist / name).read_bytes()
        source = (ROOT / "public" / name).read_bytes()
        digest = hashlib.sha256(body).hexdigest()
        if body != source or digest == old_hash:
            raise SystemExit(f"{name} is not the canonical web icon sha256={digest}")

    leaflet_js = (dist / "vendor" / "leaflet" / "leaflet.js").read_bytes()
    leaflet_css = (dist / "vendor" / "leaflet" / "leaflet.css").read_bytes()
    if leaflet_js.lstrip().startswith(b"<") or b"1.9.4" not in leaflet_js:
        raise SystemExit("leaflet.js is missing or is the SPA HTML fallback")
    if leaflet_css.lstrip().startswith(b"<") or b".leaflet-container" not in leaflet_css:
        raise SystemExit("leaflet.css is missing or is the SPA HTML fallback")
    if not (dist / "vendor" / "leaflet" / "images" / "marker-icon.png").is_file():
        raise SystemExit("leaflet marker image is missing")

    print(
        "static-ok",
        hashlib.sha256(EXPECTED).hexdigest(),
        "index",
        index.stat().st_size,
    )


def fetch(url):
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "BUKLOD-Web134-Preview", "Cache-Control": "no-cache", "Accept": "*/*"},
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.status, response.headers.get("content-type", ""), response.read()


def record_live(path):
    status, ctype, body = fetch(LIVE)
    line = f"{status} {ctype} {hashlib.sha256(body).hexdigest()} {len(body)}\n"
    pathlib.Path(path).write_text(line)
    print(line.strip())


def read_preview_url(raw_path):
    raw = pathlib.Path(raw_path).read_text(errors="replace")
    urls = re.findall(r"https://[a-z0-9-]+--[a-z0-9]+\.expo\.app/?", raw)
    if not urls:
        raise SystemExit("no preview URL in deploy output")
    url = urls[0].rstrip("/")
    summary = {"previewUrl": url}
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, dict):
            for key in ("id", "deploymentId", "url"):
                if key in parsed and not isinstance(parsed[key], (dict, list)):
                    summary[key] = parsed[key]
    except json.JSONDecodeError:
        pass
    pathlib.Path("preview-url.txt").write_text(url + "\n")
    pathlib.Path("deploy-summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("preview-url", url)


def verify_preview(live_before_path):
    preview = pathlib.Path("preview-url.txt").read_text().strip().rstrip("/")
    status, ctype, body = fetch(preview + "/app-ads.txt")
    print("preview-app-ads", status, ctype, len(body), hashlib.sha256(body).hexdigest())
    if status != 200 or not ctype.lower().startswith("text/plain") or body != EXPECTED:
        raise SystemExit("preview app-ads.txt is not the exact text file")
    before = pathlib.Path(live_before_path).read_text().strip().split()
    status, ctype, body = fetch(LIVE)
    after_hash = hashlib.sha256(body).hexdigest()
    print("live-after", status, ctype, after_hash, len(body))
    if before[2] != after_hash:
        raise SystemExit("live production homepage changed during preview deploy")
    print("live-alias-unchanged")


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "dist"
    if command == "live-before":
        record_live(sys.argv[2] if len(sys.argv) > 2 else "live-before.txt")
    elif command == "preview-url":
        read_preview_url(sys.argv[2])
    elif command == "verify-preview":
        verify_preview(sys.argv[2] if len(sys.argv) > 2 else "live-before.txt")
    else:
        verify(pathlib.Path(command))
