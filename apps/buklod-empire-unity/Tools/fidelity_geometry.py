"""Original close-up geometry refinement; preserves existing joints and materials.
All dimensions derive from the canonical hero generator, not measured likenesses.
"""
import math


def _unit(v):
    n=math.sqrt(sum(x*x for x in v))
    if n<1e-12: raise ValueError('Degenerate vector')
    return tuple(x/n for x in v)


def _sub(a,b): return tuple(x-y for x,y in zip(a,b))
def _cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])


def _triangle(h,mat,pts,normals,weights):
    if sum(x*x for x in _cross(_sub(pts[1],pts[0]),_sub(pts[2],pts[0])))<1e-18: return
    g=h.geo[mat];start=len(g['p'])
    for p,n,(a,b,w) in zip(pts,normals,weights):
        g['p'].append(p);g['n'].append(_unit(n));g['j'].append((a,b,0,0) if w>=.5 else (b,a,0,0));g['w'].append((max(w,1-w),min(w,1-w),0.,0.))
    g['i'].extend((start,start+1,start+2))


def _grid(h,mat,sample,cols,rows,back=False):
    # Each sample is (point, analytic normal, two-joint blend).
    grid=[[sample(i/cols,j/rows) for i in range(cols+1)] for j in range(rows+1)]
    for j in range(rows):
        for i in range(cols):
            a,b,c,d=grid[j][i],grid[j+1][i],grid[j+1][i+1],grid[j][i+1]
            for tri in ((a,b,c),(a,c,d)):
                p,n,w=zip(*tri)
                face=_cross(_sub(p[1],p[0]),_sub(p[2],p[0]))
                if sum(x*y for x,y in zip(face,n[0]))<0:
                    p=p[::-1];n=n[::-1];w=w[::-1]
                _triangle(h,mat,p,n,w)
                if back:_triangle(h,mat,p[::-1],[tuple(-x for x in q) for q in n[::-1]],w[::-1])


def _remove_joint_faces(h,mat,joint):
    # Original generator writes non-shared triangle vertices and sequential indices.
    g=h.geo[mat]
    if len(g['p'])%3 or g['i']!=list(range(len(g['p']))):
        raise ValueError('Unexpected original cape topology')
    keep=[i for i in range(0,len(g['p']),3) if not all(g['j'][k][0]==joint for k in range(i,i+3))]
    for key in ('p','n','j','w'):
        g[key]=[g[key][i+k] for i in keep for k in range(3)]
    g['i']=list(range(len(g['p'])))


def _detail_ellipsoid(h,mat,joint,center,size,cols=8,rows=4):
    def sample(u,v):
        a=2*math.pi*u;b=math.pi*(v-.5)
        direction=(math.cos(b)*math.cos(a),math.sin(b),math.cos(b)*math.sin(a))
        p=tuple(c+r*d for c,r,d in zip(center,size,direction))
        n=_unit(tuple(d/r for d,r in zip(direction,size)))
        return p,n,(joint,joint,1.)
    _grid(h,mat,sample,cols,rows)


def add_fidelity_geometry(h,result):
    if getattr(h,'mobile_lod',False):return
    _,pelvis,chest,head,arms,legs,mantle=result
    # Replace only original cape fabric, keeping trim and the same animation joint.
    if h.cape:
        _remove_joint_faces(h,2,mantle)
        top=1.46*h.h;bottom=(.62 if h.role in ('commander','shepherd') else .85)*h.h
        def cape(u,v):
            s=2*u-1; width=.24*h.w*(1+.4*v)
            x=s*width;y=top+(bottom-top)*v
            z=-.145-.075*v-.025*v*math.cos(6*math.pi*u)
            du=(2*width,0,.15*math.pi*v*math.sin(6*math.pi*u))
            dv=(s*.096*h.w,bottom-top,-.075-.025*math.cos(6*math.pi*u))
            n=_unit(_cross(du,dv))
            w=min(1,v*5)
            return (x,y,z),n,(mantle,chest,w)
        _grid(h,2,cape,24,14,back=True)
    # Additional individual curved locks along the rear crown, avoiding face and hood.
    if h.hair!='hood':
        count=14 if h.hair in ('long','ponytail') else 10
        width={'square':.135,'oval':.113,'round':.135,'long':.115}[h.face]
        length={'long':.19,'ponytail':.15,'crest':.09,'spike':.10,'swept':.085,'short':.055}[h.hair]
        for k in range(count):
            angle=math.pi*(.08+.84*k/max(1,count-1));radius=.009 if count==14 else .010
            def lock(u,v):
                a=2*math.pi*u;theta=angle+.13*math.sin(math.pi*v)
                x=width*.96*math.cos(theta)*(1+.12*v)
                z=-.033-.106*math.sin(theta)-.018*v
                y=h.h*(1.885-length*v)
                r=radius*(1-.75*v)
                n=(math.cos(a),0,math.sin(a))
                return (x+r*n[0],y,z+r*n[2]),n,(head,head,1.)
            _grid(h,4,lock,8,6)
    # Small shaped, finger-separated gauntlet ridges follow each existing hand bone.
    # The original grip remains intact and equipment stays attached to the hand.
    for _,_,hand in arms:
        x,y,z=h.rest[hand]
        for k in range(4):
            dx=(k-1.5)*.023
            _detail_ellipsoid(h,8,hand,(x+dx,y-.087,z+.035),(.012,.028,.014))
        _detail_ellipsoid(h,8,hand,(x+.048 if x>0 else x-.048,y-.052,z+.04),(.016,.025,.018))
    # Role-specific layered metal and cloth silhouettes, deliberately confined
    # to existing joint regions. No new bones or material slots.
    if h.role in ('guardian','commander','artisan','builder'):
        for thigh,_,_ in legs:
            x,y,z=h.rest[thigh]
            for j in range(3):
                h.plate(0,thigh,(x,y-(.055+.045*j)*h.h,z+.115),
                    [(-.060,.022),(.060,.022),(.053,-.024),(0,-.037),(-.053,-.024)],.008)
    elif h.role in ('scout','skirmisher','disruptor','controller'):
        for upper,_,_ in arms:
            x,y,z=h.rest[upper]
            for j in range(2):
                h.plate(1,upper,(x,y-(.045+.045*j)*h.h,z+.104),
                    [(-.042,.015),(.042,.015),(.028,-.028),(-.028,-.028)],.007)
    else:
        # Healer/support robes: decorated waist panels without widening the
        # collision silhouette or interfering with hands and held equipment.
        for side in (-1,1):
            h.plate(2,pelvis,(side*.125*h.waist,.84*h.h,.147),
                [(-.050,.065),(.050,.065),(.045,-.070),(0,-.105),(-.045,-.070)],.008)
            h.plate(1,pelvis,(side*.125*h.waist,.80*h.h,.164),
                [(0,.032),(.028,0),(0,-.032),(-.028,0)],.006)
    # Thin raised stitching and armour seams on the original forearm/knee equipment.
    for (_,fore,_),(_,shin,_) in zip(arms,legs):
        for joint in (fore,shin):
            x,y,z=h.rest[joint]
            for side in (-1,1):
                for j in range(4):
                    _detail_ellipsoid(h,1,joint,(x+side*.047,y-(.085+.035*j)*h.h,z+.083),(.006,.008,.004),6,3)
