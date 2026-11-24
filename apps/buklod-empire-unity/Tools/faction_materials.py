"""Generate shared faction review textures; no paid services or network."""
import argparse
import hashlib
import io
import json
from pathlib import Path

FACTORS = {'armor': (.72, .32), 'trim': (.68, .30), 'fabric': (.02, .87), 'leather': (.02, .84), 'skin': (0., .78)}
MATERIAL_KINDS = tuple(FACTORS)

def unity_mask(data, kind):
    import numpy as np
    from PIL import Image
    mr = np.asarray(Image.open(io.BytesIO(data)).convert('RGB'), dtype=np.float32)
    metal, rough = FACTORS[kind]
    out = np.full((*mr.shape[:2], 4), 255, dtype=np.uint8)
    out[:, :, 0] = np.rint(mr[:, :, 2] * metal).astype(np.uint8)
    out[:, :, 3] = np.rint(255 - mr[:, :, 1] * rough).astype(np.uint8)
    b = io.BytesIO()
    Image.fromarray(out).save(b, format='PNG', compress_level=3)
    return b.getvalue()


def generate(out, size, surface):
    from PIL import Image
    out = Path(out)
    if size not in (1024, 2048, 4096):
        raise ValueError('Expected 1K, 2K or 4K resolution')
    rows = []
    out.mkdir(parents=True, exist_ok=True)
    for kind in MATERIAL_KINDS:
        base, mr, normal = surface(kind, size)
        for role, data in (('base', base), ('mask', unity_mask(mr, kind)), ('normal', normal)):
            with Image.open(io.BytesIO(data)) as im:
                im.load()
                if im.size != (size, size) or im.mode != ('RGBA' if role == 'mask' else 'RGB'):
                    raise ValueError('Unexpected texture format')
            name = kind + '_' + role + '.png'
            (out / name).write_bytes(data)
            rows.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    manifest = {'status': 'REVIEW_ONLY', 'resolution': size, 'textures': rows}
    tmp = out / 'manifest.tmp'
    tmp.write_text(json.dumps(manifest, indent=2) + '\n')
    tmp.replace(out / 'manifest.json')
    return manifest


def main():
    from hd_surface import encoded_surface
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--size', type=int, default=2048, choices=(1024, 2048, 4096))
    a = p.parse_args()
    result = generate(Path(__file__).resolve().parent / 'ReviewOutput' / 'faction-materials', a.size, encoded_surface)
    print('Generated', len(result['textures']), 'shared review textures at', a.size)


if __name__ == '__main__':
    main()
