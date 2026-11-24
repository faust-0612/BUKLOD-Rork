import copy, hashlib, json, unittest
import variant_review as v
def fixture():
    names=['armor','trim','fabric','leather','skin','SacredStone_Diamond']
    doc={'asset':{'version':'2.0'},'buffers':[{'byteLength':4}],'animations':[{'name':str(i)} for i in range(12)],'skins':[{}],
         'materials':[{'name':n,'pbrMetallicRoughness':{'baseColorFactor':[.2,.4,.6,1],'metallicFactor':.4,'roughnessFactor':.6}} for n in names]}
    return v.pack(doc,b'ABCD')
class PremiumVariantTests(unittest.TestCase):
    def test_65_variants_preserve_rigs_and_stones(self):
        raw=fixture();out={}
        rows=v.generate(lambda _:raw,lambda name,data:out.__setitem__(name,data))
        self.assertEqual(len(rows),65)
        self.assertEqual(len(out),66)
        before,blob=v.unpack(raw)
        for row in rows:
            after,data=v.unpack(out[row['file']])
            self.assertEqual(data,blob)
            self.assertEqual(before['skins'],after['skins'])
            self.assertEqual(before['animations'],after['animations'])
            self.assertEqual(before['materials'][-2:],after['materials'][-2:])
            self.assertEqual(row['sourceSha256'],hashlib.sha256(raw).hexdigest())
            self.assertFalse(after['extras']['visualApproval'])
        self.assertEqual(len({r['sha256'] for r in rows}),65)
    def test_incomplete_source_fails(self):
        d,b=v.unpack(fixture());d['animations'].pop()
        with self.assertRaises(ValueError):v.create(v.pack(d,b),'phan','mythical')
if __name__=='__main__':unittest.main()
