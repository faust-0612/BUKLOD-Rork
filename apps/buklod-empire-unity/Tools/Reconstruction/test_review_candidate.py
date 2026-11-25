import json, struct, tempfile, unittest
from pathlib import Path
import trimesh
from review_candidate import inspect

class ReviewTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(); self.path=Path(self.tmp.name)/'model.glb'
        mesh=trimesh.creation.icosphere(subdivisions=1); mesh.visual.vertex_colors=[30,140,40,255]; mesh.export(self.path)
    def tearDown(self): self.tmp.cleanup()
    def test_good(self):
        r=inspect(self.path); self.assertGreater(r['triangles'],0); self.assertTrue(r['vertex_color']); self.assertFalse(r['production_approved'])
    def test_truncated(self):
        self.path.write_bytes(self.path.read_bytes()[:-1]); self.assertRaises(ValueError,inspect,self.path)
    def test_external(self):
        raw=self.path.read_bytes(); n=struct.unpack_from('<I',raw,12)[0]; d=json.loads(raw[20:20+n]); d['buffers'][0]['uri']='https://example.com/model.bin'; j=json.dumps(d).encode(); j+=b' '*((-len(j))%4); tail=raw[20+n:]; self.path.write_bytes(struct.pack('<4sII',b'glTF',2,20+len(j)+len(tail))+struct.pack('<I4s',len(j),b'JSON')+j+tail); self.assertRaises(ValueError,inspect,self.path)
if __name__=='__main__': unittest.main()
