"""Original close-up geometry accents; no measured likeness or external models."""
import math

REVISION='original-sculpted-geometry-v8'

def bevel_triangles(outline,depth):
    # Strict convex polygons containing their local origin only; other outlines
    # retain the canonical original extrusion. No silhouette expansion.
    if len(outline)<3 or not math.isfinite(depth) or depth<=.006:
        return None
    pts=list(outline)
    if any(not math.isfinite(x) or not math.isfinite(y) for x,y in pts):
        raise ValueError('Nonfinite armor outline')
    area=sum(x*pts[(i+1)%len(pts)][1]-y*pts[(i+1)%len(pts)][0] for i,(x,y) in enumerate(pts))
    if area<0:pts.reverse()
    n=len(pts)
    for i,(x,y) in enumerate(pts):
        u,v=pts[(i+1)%n];a,b=pts[(i+2)%n]
        if x*v-y*u<=1e-9 or (u-x)*(b-v)-(v-y)*(a-u)<=1e-9:
            return None
    bevel=min(.007,depth*.35)
    rings=[[(x,y,-depth) for x,y in pts],
           [(x,y,depth-bevel) for x,y in pts],
           [(x*.89,y*.89,depth) for x,y in pts]]
    out=[]
    for i in range(n):
        j=(i+1)%n
        out.append(((0,0,-depth),rings[0][j],rings[0][i]))
        for a,b in zip(rings,rings[1:]):
            out.extend(((a[i],a[j],b[j]),(a[i],b[j],b[i])))
        out.append(((0,0,depth+.015),rings[2][i],rings[2][j]))
    return out

def bevel_plate(h,mat,joint,center,outline,depth):
    tris=bevel_triangles(outline,depth)
    if tris is None:return False
    for tri in tris:
        h.tri(mat,joint,[tuple(a+b for a,b in zip(center,p)) for p in tri])
    return True

def facial_relief(x,y,z,head_height,cheek_width):
    # Shallow sculpting: eye sockets, cheeks, brow and chin. Smooth Gaussian
    # gradients, bounded displacement and analytic Jacobian for normal repair.
    # y is relative to head center, z relative to head center.
    if head_height<=0 or cheek_width<=0:raise ValueError('Invalid face dimensions')
    sx=x/cheek_width;sy=y/head_height
    terms=[]
    for side in (-1,1):
        terms.extend(((.005,side*.56,-.10,.27,.27),
                      (-.004,side*.43,.12,.23,.17),
                      (.0025,side*.40,.37,.29,.14)))
    terms.append((.003,0,-.60,.39,.19))
    value=dx=dy=0.
    for amplitude,cx,cy,wx,wy in terms:
        u=(sx-cx)/wx;v=(sy-cy)/wy
        e=amplitude*math.exp(-.5*(u*u+v*v))
        value+=e;dx-=e*u/(wx*cheek_width);dy-=e*v/(wy*head_height)
    t=max(0.,min(1.,z/.10))
    gate=t*t*(3-2*t)
    dg=6*t*(1-t)/.10 if 0<t<1 else 0.
    return value*gate,dx*gate,dy*gate,value*dg

def sculpt_point(p,n,center,height,width):
    x,y,z=p
    d,dx,dy,dz=facial_relief(x-center[0],y-center[1],z-center[2],height,width)
    if 1+dz<=.75:raise ValueError('Invalid sculpt gradient')
    # inverse transpose of (x,y,z+d(x,y,z))
    nz=n[2]/(1+dz)
    normal=(n[0]-dx*nz,n[1]-dy*nz,nz)
    length=math.sqrt(sum(q*q for q in normal))
    if length<1e-9:raise ValueError('Degenerate sculpt normal')
    return (x,y,z+d),tuple(q/length for q in normal)
