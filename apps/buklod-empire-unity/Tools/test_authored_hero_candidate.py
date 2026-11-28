import importlib.util, pathlib, unittest
P=pathlib.Path(__file__).with_name("authored-hero-candidate.py")
spec=importlib.util.spec_from_file_location("candidate",P)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class CandidateTests(unittest.TestCase):
    def setUp(self):
        self.source={"sha256":"hash","triangles":150000,"joints":[["Hips","Head"]],"clips":{x:1 for x in m.SLOTS}}
        self.mapping={"heroId":"phan","sourceSha256":"hash","clips":{x:x for x in m.SLOTS},"author":"test","sourceUrl":"test","license":"CC0-1.0","licenseEvidence":"test"}
    def test_mapping_rejects_duplicate_skill_and_unknown_rights(self):
        self.assertEqual(m.validate_mapping(self.source,self.mapping),self.mapping["clips"])
        self.mapping["clips"]["Ultimate"]="Attack"
        with self.assertRaises(ValueError):m.validate_mapping(self.source,self.mapping)
        self.mapping["clips"]["Ultimate"]="Ultimate";self.mapping["license"]="unknown"
        with self.assertRaises(ValueError):m.validate_mapping(self.source,self.mapping)
    def test_lod_rejects_rig_drift_and_missing_animations(self):
        out=dict(self.source,triangles=5000)
        m.verify_lod(self.source,out,5000)
        for row in (dict(out,triangles=5001),dict(out,joints=[["Head","Hips"]]),dict(out,clips={})):
            with self.assertRaises(ValueError):m.verify_lod(self.source,row,5000)
if __name__=="__main__":unittest.main()
