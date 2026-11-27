import math, unittest
from sculpt_geometry import bevel_triangles, facial_relief, sculpt_point
class SculptGeometryTests(unittest.TestCase):
    def test_bevel_closed_manifold_and_bounds(self):
        from collections import Counter
        pts=[(-.2,-.1),(.2,-.1),(.22,.1),(0,.2),(-.22,.1)]
        tris=bevel_triangles(pts,.035)
        self.assertEqual(len(tris),len(pts)*6)
        edges=Counter(tuple(sorted((a,b))) for tri in tris for a,b in zip(tri,tri[1:]+tri[:1]))
        self.assertTrue(all(n==2 for n in edges.values()))
        self.assertEqual(max(p[2] for tri in tris for p in tri),.05)
        self.assertEqual(min(p[2] for tri in tris for p in tri),-.035)
        self.assertEqual(max(abs(p[0]) for tri in tris for p in tri),.22)
        self.assertEqual(tris,bevel_triangles(list(reversed(pts)),.035))
    def test_nonconvex_and_tiny_fallback(self):
        self.assertIsNone(bevel_triangles([(0,0),(1,0),(1,1)],.02))
        self.assertIsNone(bevel_triangles([(-1,-1),(1,-1),(0,0),(1,1),(-1,1)],.02))
        self.assertIsNone(bevel_triangles([(-1,-1),(1,-1),(1,1),(-1,1)],.001))
    def test_face_depth_tracks_taper_and_hood_boundary(self):
        from types import SimpleNamespace
        from identity_detail import face_depth, PROFILES
        h=SimpleNamespace(id='phan',face='square',hair='crest',h=1.04)
        y=1.76*h.h-.09;x=.07;r=.154*h.h;w=.135
        taper=PROFILES[h.id][0]*(.09/r)**2
        z=.119*math.sqrt(1-(x/(w*(1-taper)))**2-(.09/r)**2)
        self.assertAlmostEqual(face_depth(h,x,y),z+facial_relief(x,y-1.76*h.h,z,r,w)[0])
        h.id='vhen';h.face='round';h.hair='hood'
        self.assertEqual(face_depth(h,.2,1.755*h.h),0)
        self.assertGreater(face_depth(h,0,1.755*h.h),.14)
    def test_small_eye_details_are_not_repositioned(self):
        from types import SimpleNamespace
        from identity_detail import adjust_feature
        h=SimpleNamespace(id='phan',face='square',hair='crest',h=1.04,nodes=[{'name':'Head'}])
        center=(.045,1.85,.12);size=(.0022,.0022,.0015)
        self.assertEqual(adjust_feature(h,5,0,center,size),(center,size))
        self.assertNotEqual(adjust_feature(h,5,0,center,(.027,.011,.011)),(center,(.027,.011,.011)))
    def test_relief_gradient_and_normals(self):
        x,y,z=.045,-.012,.09;h,w=.16,.13
        d,dx,dy,dz=facial_relief(x,y,z,h,w)
        eps=1e-6
        for axis,expected in enumerate((dx,dy,dz)):
            a=[x,y,z];b=a[:];a[axis]+=eps;b[axis]-=eps
            actual=(facial_relief(*a,h,w)[0]-facial_relief(*b,h,w)[0])/(2*eps)
            self.assertAlmostEqual(expected,actual,places=5)
        p,n=sculpt_point((x,y,z),(0,0,1),(0,0,0),h,w)
        self.assertLess(abs(p[2]-z),.01)
        self.assertAlmostEqual(sum(q*q for q in n),1)
        self.assertEqual(facial_relief(x,y,-.1,h,w),(0,0,0,0))
if __name__=='__main__':unittest.main()
