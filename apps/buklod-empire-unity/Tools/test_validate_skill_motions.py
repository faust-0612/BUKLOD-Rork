"""Run after prepare-hero-review.py; no paid tooling or Unity needed."""
import copy, json, pathlib, struct, unittest
from validate_skill_motions import validate_hero, validate_roster

ROOT=pathlib.Path(__file__).resolve().parent/'ReviewOutput/heroes'
class MotionValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.raw=(ROOT/'phan.glb').read_bytes()
        n=struct.unpack_from('<I',cls.raw,12)[0]
        cls.doc=json.loads(cls.raw[20:20+n]);cls.buf=cls.raw[28+n:]
    def pack(self,d):
        j=json.dumps(d,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
        return struct.pack('<4sII',b'glTF',2,28+len(j)+len(self.buf))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(self.buf),b'BIN\0')+self.buf
    def mutate(self,edit):
        d=copy.deepcopy(self.doc);edit(d)
        with self.assertRaises(ValueError):validate_hero(self.pack(d),'phan')
    def test_full_roster(self):
        self.assertEqual(validate_roster(ROOT)['distinctSkillMotions'],39)
    def test_wrong_skill(self):
        self.mutate(lambda d:next(a for a in d['animations'] if a['name']=='Primary')['extras'].update(canonicalSkill='wrong'))
    def test_missing_joint(self):
        self.mutate(lambda d:next(a for a in d['animations'] if a['name']=='Primary')['channels'].pop())
    def test_duplicate_name(self):
        self.mutate(lambda d:next(a for a in d['animations'] if a['name']=='Secondary').update(name='Primary'))
    def test_truncated_glb(self):
        with self.assertRaises(ValueError):validate_hero(self.raw[:-1],'phan')
if __name__=='__main__':unittest.main()
