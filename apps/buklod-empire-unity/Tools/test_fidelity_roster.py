"""End-to-end geometry gate on canonical GLB generator; no Unity or textures needed."""
import importlib.util, json, pathlib, struct, tempfile, unittest
from unittest.mock import patch
from prepare_hero_lod import inspect, hero

def mesh_checks(data):
    n=struct.unpack_from('<I',data,12)[0];d=json.loads(data[20:20+n]);buf=data[28+n:]
    def values(i,fmt):
        a=d['accessors'][i];v=d['bufferViews'][a['bufferView']]
        width=struct.calcsize('<'+fmt)
        start=v.get('byteOffset',0)+a.get('byteOffset',0);end=start+a['count']*width
        if end>len(buf) or end>v.get('byteOffset',0)+v['byteLength']:raise ValueError('Accessor bounds')
        return list(struct.iter_unpack('<'+fmt,buf[start:end]))
    for m in d['meshes']:
        for p in m['primitives']:
            a=p['attributes'];count=d['accessors'][a['POSITION']]['count']
            if count>=65536 or max(x[0] for x in values(p['indices'],'H'))>=count:raise ValueError('Index range')
            for j,w in zip(values(a['JOINTS_0'],'HHHH'),values(a['WEIGHTS_0'],'ffff')):
                if max(j)>=len(d['skins'][0]['joints']) or min(w)<0 or abs(sum(w)-1)>1e-5:raise ValueError('Skin weights')

class RosterGeometryTests(unittest.TestCase):
    def test_all_canonical_models_keep_rig_and_animation(self):
        with tempfile.TemporaryDirectory() as t:
            root=pathlib.Path(t)
            hashes=set()
            for id,profile in hero.original.HEROES.items():
                with self.subTest(hero=id):
                    old=root/'old.glb';new=root/'new.glb';lod=root/'lod.glb'
                    with patch.object(hero,'add_fidelity_geometry',lambda *_:None):
                        hero.Candidate(id,profile).export(old)
                    row=hero.Candidate(id,profile).export(new)
                    fallback=hero.Candidate(id,profile);fallback.mobile_lod=True;fallback.export(lod)
                    a,b,c=[inspect(p.read_bytes()) for p in (old,new,lod)]
                    self.assertEqual(a[:5],b[:5])
                    self.assertEqual(b[:5],c[:5])
                    self.assertGreater(b[5],a[5])
                    self.assertLess(c[5],.8*b[5])
                    self.assertNotIn(row['meshHash'],hashes);hashes.add(row['meshHash'])
                    mesh_checks(new.read_bytes())
            self.assertEqual(len(hashes),13)

if __name__=='__main__':unittest.main()
