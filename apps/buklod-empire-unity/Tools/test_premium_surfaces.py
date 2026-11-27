import importlib.util, io, unittest
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
    def test_host_rejected(self):
        with self.assertRaises(ValueError):m.request("https://example.com/",1,"dl.polyhaven.org")
if __name__=="__main__":unittest.main()
