from pathlib import Path
import base64, gzip, hashlib, io, re

ROOT = Path(__file__).resolve().parent
packed = ROOT / '.packed'
parts = sorted(packed.glob('reportHtml.gz.b64.part*'))
if len(parts) != 4:
    raise SystemExit(f'Expected 4 packed Report engine parts, found {len(parts)}')

b64 = ''.join(p.read_text(encoding='utf-8').strip() for p in parts)
raw = gzip.decompress(base64.b64decode(b64))
expected = 'b6fb53cfb33e539453022a537db67558822b6e34fa364873a45dfae92255856e'
actual = hashlib.sha256(raw).hexdigest()
if actual != expected:
    raise SystemExit(f'Report engine hash mismatch: {actual}')
(ROOT / 'reportHtml.js').write_bytes(raw)

text = raw.decode('utf-8')
m = re.search(r'data:image/webp;base64,([A-Za-z0-9+/=]+)', text)
if not m:
    raise SystemExit('Embedded official BUKLOD Report icon was not found')

from PIL import Image
img = Image.open(io.BytesIO(base64.b64decode(m.group(1)))).convert('RGBA')
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)

# Launcher and splash use the exact approved Report artwork derivative already embedded in the protected engine.
launcher = img.resize((512, 512), Image.Resampling.LANCZOS).convert('P', palette=Image.Palette.ADAPTIVE, colors=256)
launcher.save(assets / 'icon.png', optimize=True)
launcher.save(assets / 'splash.png', optimize=True)

# Adaptive foreground gets inset breathing room to avoid Android mask clipping.
fg = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
inset = img.resize((410, 410), Image.Resampling.LANCZOS)
fg.alpha_composite(inset, ((512 - 410) // 2, (512 - 410) // 2))
fg.save(assets / 'adaptive-foreground.png', optimize=True)

print('REPORT_ENGINE_SHA256=' + actual)
print('ICON_READY=1')
