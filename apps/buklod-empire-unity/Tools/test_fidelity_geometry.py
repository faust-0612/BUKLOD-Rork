import unittest, math, copy
from collections import defaultdict
from fidelity_geometry import add_fidelity_geometry,_triangle,_unit,_cross,_sub
from sculpt_geometry import bevel_plate

class Fixture:
    def __init__(self,hair='long',cape=True,lod=False,face='oval',role='commander'):
        self.h=1.03; self.w=.93; self.waist=1.; self.hair=hair; self.cape=cape; self.face=face;self.role=role;self.mobile_lod=lod
        self.rest=[(0.,0.,0.)]*18
        for i in (6,7,8,9,10,11):self.rest[i]=(-.25 if i<9 else .25, .9,0.)
        self.geo=defaultdict(lambda:{'p':[],'n':[],'j':[],'w':[],'i':[]})
        p=[(0.,1.,-.1),(.1,1.,-.1),(0.,.9,-.1)];n=[(0.,0.,-1.)]*3
        _triangle(self,2,p,n,[(2,2,1.)]*3)
        if cape:_triangle(self,2,p,n,[(17,17,1.)]*3)
        self.result=(0,1,2,4,[(5,6,7),(8,9,10)],[(11,12,13),(14,15,16)],17)

    def plate(self,mat,joint,center,outline,depth):
        if not bevel_plate(self,mat,joint,center,outline,depth):
            raise AssertionError("Expected a valid beveled role plate")

    def tri(self,mat,joint,points):
        a,b,c=points
        normal=_unit(_cross(_sub(b,a),_sub(c,a)))
        _triangle(self,mat,points,[normal]*3,[(joint,joint,1.)]*3)

class GeometryTests(unittest.TestCase):
    def test_geometry_finite_normalized_and_indexed(self):
        for hair in ('long','ponytail','crest','spike','swept','short','hood'):
            f=Fixture(hair=hair); add_fidelity_geometry(f,f.result)
            for g in f.geo.values():
                self.assertEqual(g['i'],list(range(len(g['p']))))
                self.assertEqual(len(g['p']),len(g['n']));self.assertEqual(len(g['p']),len(g['w']))
                self.assertLess(len(g['p']),65536)
                for p,n,j,w in zip(g['p'],g['n'],g['j'],g['w']):
                    self.assertTrue(all(math.isfinite(x) for x in (*p,*n,*w)))
                    self.assertAlmostEqual(sum(x*x for x in n),1)
                    self.assertAlmostEqual(sum(w),1)
                    self.assertTrue(all(0<=x<18 for x in j));self.assertTrue(all(0<=x<=1 for x in w))
                for i in range(0,len(g['p']),3):
                    a,b,c=g['p'][i:i+3];u=[y-x for x,y in zip(a,b)];v=[y-x for x,y in zip(a,c)]
                    cross=(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])
                    self.assertGreater(sum(x*x for x in cross),1e-18)
    def test_cape_replaces_only_mantle_and_blends(self):
        f=Fixture();preserved=copy.deepcopy(f.geo[2]['p'][:3]);add_fidelity_geometry(f,f.result)
        self.assertEqual(f.geo[2]['p'][:3],preserved)
        self.assertTrue(any(0<w[1]<1 for w in f.geo[2]['w']))
        self.assertTrue(any(17 in j and 2 in j for j in f.geo[2]['j']))
        self.assertEqual(len(f.rest),18)
    def test_fallback_unchanged_and_hood_excluded(self):
        f=Fixture(lod=True);before=copy.deepcopy(f.geo);add_fidelity_geometry(f,f.result);self.assertEqual(f.geo,before)
        f=Fixture(hair='hood',cape=False);add_fidelity_geometry(f,f.result);self.assertNotIn(4,f.geo)
        self.assertEqual(len(f.geo[2]['p']),3)
    def test_determinism(self):
        a,b=Fixture(),Fixture();add_fidelity_geometry(a,a.result);add_fidelity_geometry(b,b.result);self.assertEqual(a.geo,b.geo)

if __name__=='__main__':unittest.main()
