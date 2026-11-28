"""Check the original hazard pose table against both pinned GLB skin hierarchies."""
import hashlib
import json
from pathlib import Path
import re
import struct
import unittest

PROJECT = Path(__file__).resolve().parents[1]
PALETTE = PROJECT / 'Tools/AssetCandidates/LibraryFirst'


class HazardRigBindings(unittest.TestCase):
    def test_pose_tracks_bind_to_unique_skin_joints(self):
        manifest = json.loads((PALETTE / 'manifest.json').read_text())
        source = (PROJECT / 'Assets/Editor/ReviewHazardMotion.cs').read_text()
        demon_only = source.split('if(demon&&action=="Move"){')[1].split('}else if(action=="Hit")')[0]
        hit, death = source.split('}else if(action=="Hit"){')[1].split('}else if(action=="Death"){')
        death = death.split('}else throw')[0]

        for model, demon in [('quaternius-demon.glb', True), ('Snake.glb', False)]:
            with self.subTest(model=model):
                row = next(row for row in manifest['models'] if row['name'] == model)
                self.assertEqual(manifest['license'], 'CC0-1.0')
                data = (PALETTE / row['source'] / model).read_bytes()
                self.assertEqual(hashlib.sha1(f'blob {len(data)}\0'.encode() + data).hexdigest(), row['gitBlob'])
                size = struct.unpack_from('<I', data, 12)[0]
                document = json.loads(data[20:20 + size])
                joints = {joint for skin in document['skins'] for joint in skin['joints']}
                names = [document['nodes'][joint]['name'] for joint in joints]
                tracks = [demon_only] if demon else []
                tracks.extend(block.split('if(demon){')[1].split('}else{')[0 if demon else 1] for block in (hit, death))
                bones = re.findall(r'Pose\("([^"]+)"', '\n'.join(tracks))
                self.assertGreaterEqual(len(set(bones)), 6)
                for bone in bones:
                    self.assertEqual(names.count(bone), 1, bone)


if __name__ == '__main__':
    unittest.main()
