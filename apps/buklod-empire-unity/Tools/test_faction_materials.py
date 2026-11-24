import hashlib
import io
import tempfile
import unittest
from pathlib import Path
from PIL import Image
from faction_materials import generate, MATERIAL_KINDS, FACTORS, unity_mask


def fixture(kind, size):
    result = []
    for rgb in ((240, 240, 240), (255, 220, 255), (128, 128, 255)):
        b = io.BytesIO()
        Image.new('RGB', (size, size), rgb).save(b, format='PNG')
        result.append(b.getvalue())
    return tuple(result)


class TestSharedMaterials(unittest.TestCase):
    def test_complete_and_hash_valid(self):
        with tempfile.TemporaryDirectory() as d:
            a = generate(d, 1024, fixture)
            self.assertEqual(len(a['textures']), 15)
            self.assertEqual({r['file'] for r in a['textures']}, {f'{k}_{s}.png' for k in MATERIAL_KINDS for s in ('base', 'mask', 'normal')})
            for row in a['textures']:
                b = (Path(d)/row['file']).read_bytes()
                self.assertEqual(len(b), row['bytes'])
                self.assertEqual(hashlib.sha256(b).hexdigest(), row['sha256'])
            self.assertEqual(a, generate(d, 1024, fixture))

    def test_exact_metallic_and_roughness_conversion(self):
        for kind, (metal, rough) in FACTORS.items():
            _, mr, _ = fixture(kind, 2)
            pixel = Image.open(io.BytesIO(unity_mask(mr, kind))).getpixel((0,0))
            self.assertEqual(pixel, (round(255*metal),255,255,round(255-220*rough)))

    def test_bad_resolution_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                generate(d, 3000, fixture)

    def test_bad_texture_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                generate(d, 1024, lambda *_: fixture('armor', 32))
            self.assertFalse((Path(d)/'manifest.json').exists())

if __name__ == '__main__':
    unittest.main()
