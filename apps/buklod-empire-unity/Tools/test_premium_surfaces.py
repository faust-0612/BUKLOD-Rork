import importlib.util, io, unittest, json, tempfile
from pathlib import Path
from PIL import Image
spec=importlib.util.spec_from_file_location("surfaces",Path(__file__).with_name("acquire-premium-surfaces.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
    def test_alpha(self):
        old=m.RES;m.RES=2
        try:
            def png(im):
                b=io.BytesIO();im.save(b,format="PNG");return b.getvalue()
            result=m.pack(png(Image.new("RGB",(2,2),(30,70,100))),png(Image.new("L",(2,2),200)))
            self.assertEqual(Image.open(io.BytesIO(result)).getpixel((0,0)),(30,70,100,55))
            with self.assertRaises(ValueError):m.pack(png(Image.new("RGB",(1,1))),png(Image.new("L",(2,2))))
        finally:m.RES=old
    def test_normal_map_preserves_channels(self):
        old=m.RES;m.RES=2
        try:
            b=io.BytesIO();Image.new("RGB",(2,2),(128,128,255)).save(b,format="PNG")
            self.assertEqual(Image.open(io.BytesIO(m.normal_png(b.getvalue()))).getpixel((0,0)),(128,128,255))
        finally:m.RES=old
    def test_descriptor(self):
        row={"url":"https://dl.polyhaven.org/test","size":10,"md5":"a"*32}
        self.assertEqual(m.select({"diff":{"4k":{"jpg":row}}},"diff"),row)
        with self.assertRaises(ValueError):m.select({"diff":{"4k":{"jpg":dict(row,size=0)}}},"diff")
    def test_oversized_normal_png_uses_bounded_4k_jpg(self):
        png={"url":"https://dl.polyhaven.org/normal.png","size":92592376,"md5":"a"*32}
        jpg={"url":"https://dl.polyhaven.org/normal.jpg","size":18436512,"md5":"b"*32}
        doc={"nor_gl":{"4k":{"png":png,"jpg":jpg},"2k":{"jpg":jpg}}}
        self.assertEqual(m.select(doc,"nor_gl"),jpg)
        doc["nor_gl"]["4k"]["png"]=dict(png,size=m.LIMIT)
        self.assertEqual(m.select(doc,"nor_gl"),doc["nor_gl"]["4k"]["png"])
        doc["nor_gl"]["4k"]={"png":png}
        with self.assertRaises(ValueError):m.select(doc,"nor_gl")
    def test_v2_descriptor(self):
        row={"url":"https://dl.polyhaven.org/test","size":10,"md5":"a"*32}
        self.assertEqual(m.select({"message":"OK","data":{"diff":{"4k":{"jpg":row}}}},"diff"),row)
    def test_provider_title_case_maps(self):
        row={"url":"https://dl.polyhaven.org/test","size":10,"md5":"a"*32}
        for key,alias in (("diff","Diffuse"),("rough","Rough")):
            self.assertEqual(m.select({"data":{alias:{"4k":{"jpg":row}}}},key),row)
    def test_missing_maps_fail_with_context(self):
        for doc in ({},{"data":None},{"data":{"rough":{"4k":{}}}},{"diff":{"2k":{}}}):
            with self.assertRaises(ValueError):m.select(doc,"diff")
    def test_cache_integrity_and_no_silent_downgrade(self):
        old=m.RES;m.RES=2
        try:
            with tempfile.TemporaryDirectory() as tmp:
                folder=Path(tmp);rows=[]
                for kind,asset in m.ASSETS.items():
                    row={"kind":kind,"asset":asset}
                    for name,length,digest,suffix in (("file","bytes","sha256",".png"),("normalFile","normalBytes","normalSha256","-normal.png")):
                        path=folder/(kind+suffix);Image.new("RGB",(2,2),(128,128,255)).save(path)
                        row.update({name:path.name,length:path.stat().st_size,digest:m.sha(path.read_bytes())})
                    rows.append(row)
                doc={"status":"POLYHAVEN_CC0_REVIEW_ONLY","resolution":2,"provider":"Poly Haven","license":"CC0","productionApproved":False,"textures":rows}
                (folder/"manifest.json").write_text(json.dumps(doc))
                self.assertEqual(m.verify_cache(folder),doc)
                (folder/"soil-normal.png").write_bytes(b"bad")
                with self.assertRaises(ValueError):m.verify_cache(folder)
        finally:m.RES=old
    def test_host_rejected(self):
        with self.assertRaises(ValueError):m.request("https://example.com/",1,"dl.polyhaven.org")
if __name__=="__main__":unittest.main()
