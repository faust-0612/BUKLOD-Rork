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
