#!/usr/bin/env python3
"""Geometry-only fixture; Unity import and visual acceptance remain separate."""
import math, unittest
from types import SimpleNamespace
from joint_geometry import bridge_sample, add_joint_geometry

class JointGeometryTests(unittest.TestCase):
    def fixture(self,low=False):
        rest=[(0,0,0),(0,.91,0),(0,1.2,0),(0,1.49,0),(0,1.61,0)]
        for sign in (-1,1):
            rest.extend([(sign*.24,1.41,0),(sign*.32,1.11,0),(sign*.32,.86,0),
                         (sign*.115,.84,0),(sign*.115,.46,0),(sign*.115,.13,0)])
        rest.append((0,1.43,-.13))
        return SimpleNamespace(rest=rest,geo={2:{k:[] for k in ('p','n','j','w','i')}},h=1,w=1,waist=1,mobile_lod=low),(0,1,2,4,[(5,6,7),(11,12,13)],[(8,9,10),(14,15,16)],17)
    def test_full_and_low_geometry(self):
        for low,expected in [(False,2048),(True,512)]:
            h,result=self.fixture(low)
            self.assertEqual(add_joint_geometry(h,result),expected)
            g=h.geo[2]
            self.assertEqual(len(g['i']),expected*3)
            self.assertEqual(g['i'],list(range(expected*3)))
            self.assertTrue(any(0<w[1]<=.5 for w in g['w']))
            for p,n,w in zip(g['p'],g['n'],g['w']):
                self.assertTrue(all(math.isfinite(x) for x in p+n+w))
                self.assertAlmostEqual(sum(w),1)
                self.assertAlmostEqual(sum(x*x for x in n),1)
    def test_seam_and_weight_endpoints(self):
        h,_=self.fixture()
        for v in (0,.25,.5,.75,1):
            p,n,w=bridge_sample(h,5,6,.058,.06,.09,0,v)
            q,m,z=bridge_sample(h,5,6,.058,.06,.09,1,v)
            for a,b in zip(p,q):self.assertAlmostEqual(a,b)
            for a,b in zip(n,m):self.assertAlmostEqual(a,b)
            self.assertEqual(w,z)
            self.assertAlmostEqual(w[2],1-v*v*(3-2*v))
        self.assertEqual(bridge_sample(h,5,6,.058,.06,.09,0,0)[2],(5,6,1))
        self.assertEqual(bridge_sample(h,5,6,.058,.06,.09,0,1)[2],(5,6,0))
if __name__=='__main__':unittest.main()
