import io, os, unittest
from unittest.mock import patch
import numpy as np
from PIL import Image
from hd_surface import encoded_surface, review_size

class HdSurfaceTests(unittest.TestCase):
    def test_resolution_contract(self):
        for v in ('256','1024','2048','4096'):
            with patch.dict(os.environ,{'BUKLOD_REVIEW_TEXTURE_SIZE':v}):
                self.assertEqual(review_size(),int(v))
        with patch.dict(os.environ,{'BUKLOD_REVIEW_TEXTURE_SIZE':'3000'}):
            with self.assertRaises(ValueError): review_size()
    def test_materials_and_normal_integrity(self):
        for kind in ('armor','trim','fabric','hair','leather','skin','lip'):
            maps=encoded_surface(kind,1024)
            self.assertEqual(len(maps),3)
            a,r,n=[np.asarray(Image.open(io.BytesIO(m))) for m in maps]
            self.assertEqual(a.shape,(1024,1024,3))
            self.assertGreater(np.std(a[:,:,0]),.2)
            self.assertTrue(np.all(r[:,:,0]==255) and np.all(r[:,:,2]==255))
            unit=n.astype(np.float32)/127.5-1
            self.assertLess(float(np.max(np.abs(np.linalg.norm(unit,axis=2)-1))),.015)
            self.assertTrue(np.all(unit[:,:,2]>0))
    def test_2k_real_detail_and_repeatability(self):
        a=encoded_surface('armor',2048)
        encoded_surface.cache_clear()
        self.assertEqual(a,encoded_surface('armor',2048))
        arr=np.asarray(Image.open(io.BytesIO(a[0])))
        self.assertEqual(arr.shape,(2048,2048,3))
        self.assertGreater(np.unique(arr[:,:,0]).size,8)
        self.assertTrue(np.any(arr[::2,::2]!=arr[1::2,1::2]))

if __name__=='__main__': unittest.main()
