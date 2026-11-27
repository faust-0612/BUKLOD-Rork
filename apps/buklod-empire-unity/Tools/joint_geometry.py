"""Continuous flexible joint geometry for the original review rigs.
No new bones, materials, root motion, equipment or texture dependencies.
"""
import math
from fidelity_geometry import _grid

REVISION='original-joint-geometry-v7'

def smooth(t):
    return t*t*(3-2*t)

def bridge_sample(h,a,b,rx,rz,half,u,v):
    # Bone a is proximal and b is distal. The sleeve crosses the b pivot.
    pa,pb=h.rest[a],h.rest[b]
    dx,dy,dz=(pb[i]-pa[i] for i in range(3))
    length=math.sqrt(dx*dx+dy*dy+dz*dz)
    if length<=1e-6 or abs(dz)>1e-6:
        raise ValueError('Unexpected original limb axis')
    ax,ay=dx/length,dy/length
    sx,sy=-ay,ax
    angle=2*math.pi*u
    c,s=math.cos(angle),math.sin(angle)
    along=(2*v-1)*half
    # Slightly fuller at the pivot, slimmer beneath the existing armour.
    flare=1+.07*math.sin(math.pi*v)
    x=pb[0]+ax*along+sx*rx*flare*c
    y=pb[1]+ay*along+sy*rx*flare*c
    z=pb[2]+rz*flare*s
    # Analytic cross-section normal; axial correction accounts for flare.
    radial=(sx*c/rx,sy*c/rx,s/rz)
    dr=.07*math.pi*math.cos(math.pi*v)/(2*half)
    normal=(radial[0]-ax*dr,radial[1]-ay*dr,radial[2])
    # 100% proximal -> 100% distal; same weights at duplicated seam vertices.
    return (x,y,z),normal,(a,b,1-smooth(v))

def add_joint_geometry(h,result):
    _,pelvis,chest,head,arms,legs,_=result
    low=getattr(h,'mobile_lod',False)
    cols,rows=(8,4) if low else (16,8)
    specs=[]
    for (upper,fore,hand),(thigh,shin,foot) in zip(arms,legs):
        # Fabric only. Hard armor, hand-held equipment, feet and stone remain rigid.
        specs.extend([
            (chest,upper,.064*h.w,.067,.080*h.h),
            (upper,fore,.058,.060,.090*h.h),
            (pelvis,thigh,.071*h.waist,.079,.085*h.h),
            (thigh,shin,.068,.073,.095*h.h),
        ])
    before=len(h.geo[2]['p'])
    for a,b,rx,rz,half in specs:
        # No cap: ends overlap existing upper/lower body geometry.
        def sample(u,v):
            return bridge_sample(h,a,b,rx,rz,half,u,v)
        _grid(h,2,sample,cols,rows)
    added=len(h.geo[2]['p'])-before
    if added!=len(specs)*cols*rows*6:
        raise ValueError('Incomplete flexible joint topology')
    g=h.geo[2]
    for i in range(before,len(g['p'])):
        w=g['w'][i]
        if not all(math.isfinite(q) for q in (*g['p'][i],*g['n'][i],*w)) or min(w)<0 or abs(sum(w)-1)>1e-6:
            raise ValueError('Invalid joint surface or skin weights')
    return added//3
