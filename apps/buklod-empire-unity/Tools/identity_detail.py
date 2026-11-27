"""Original procedural facial and signature-equipment refinement; review only."""
import math
from sculpt_geometry import facial_relief, sculpt_point
from fidelity_geometry import _grid

# Jaw taper, brow tilt, eye width, nose width, mouth width. Art candidates,
# not measurements of people or assertions of portrait likeness.
PROFILES={
    'phan':(.13,-.12,.96,1.10,1.06),'quin':(.23,.12,1.12,.82,.92),
    'van':(.09,-.06,1.00,1.06,1.04),'christian':(.07,-.20,.92,1.16,1.12),
    'lhen':(.25,.08,1.16,.80,.96),'ace':(.15,.02,1.05,.94,1.00),
    'ellusur':(.17,-.04,.94,1.12,1.08),'jawo':(.12,-.16,.98,1.05,1.10),
    'mitch':(.06,-.03,.94,1.22,1.15),'niel':(.21,-.10,1.01,.92,.98),
    'angel':(.24,.06,1.10,.86,.94),'vhen':(.16,.10,1.04,.97,1.03),
    'trudice':(.26,.14,1.15,.79,.90),
}

def head_joint(h,joint):
    return joint<len(h.nodes) and h.nodes[joint]['name']=='Head'

def face_depth(h,x,y):
    """Front surface of the existing head (including the hood face insert)."""
    w={'square':.135,'oval':.113,'round':.135,'long':.115}[h.face]
    r={'square':.154,'oval':.166,'round':.15,'long':.178}[h.face]*h.h
    # Invert the same jaw taper used by the sculpted surface, otherwise
    # the mouth and nose float on a wider imaginary head.
    dy=y-1.76*h.h
    taper=PROFILES[h.id][0]*max(0,min(1,-dy/r))**2
    z=.119*math.sqrt(max(0,1-(x/(w*(1-taper)))**2-(dy/r)**2))
    if h.hair=='hood':
        hood=1-(x/.105)**2-((y-1.755*h.h)/.131)**2
        if hood>=0:z=max(z,.075+.075*math.sqrt(hood))
    else:z+=facial_relief(x,dy,z,r,w)[0]
    return z

def adjust_feature(h,mat,joint,center,size):
    if not head_joint(h,joint):return center,size
    x,y,z=center;_,_,eye,nose,_=PROFILES[h.id]
    if (mat==5 and tuple(size)==(.027,.011,.011)) or (mat==6 and tuple(size)==(.009,.009,.006)):
        x*=1.01 if h.face=='round' else .97
        z=face_depth(h,x,y)+(.0015 if mat==5 else .007)
        size=(size[0]*eye,size[1]*(.78 if mat==5 else .88),size[2]*.48)
    elif mat==3 and tuple(size)==(.019,.028,.027):
        z=face_depth(h,x,y)+.008;size=(size[0]*nose,.024,.019)
    return (x,y,z),size

def sculpt_surface(h,mat,joint,center,size,start):
    if mat!=3 or not head_joint(h,joint) or center[0]!=0 or center[2]!=0 or abs(center[1]-1.76*h.h)>1e-6:return
    taper=PROFILES[h.id][0];g=h.geo[mat]
    for i in range(start,len(g['p'])):
        x,y,z=g['p'][i];nx,ny,nz=g['n'][i]
        v=max(0,min(1,(center[1]-y)/size[1]));a=1-taper*v*v
        derivative=2*taper*v/size[1] if 0<v<1 else 0
        g['p'][i]=(x*a,y,z)
        n=(nx/a,ny-nx*x*derivative/a,nz);length=math.sqrt(sum(q*q for q in n))
        g['n'][i]=tuple(q/max(length,1e-9) for q in n)
        if h.hair!='hood':g['p'][i],g['n'][i]=sculpt_point(g['p'][i],g['n'][i],center,size[1],size[0])

def replace_face_box(h,mat,joint,c,s):
    if not head_joint(h,joint):return False
    x,y,z=c;_,tilt,eye,_,mouth=PROFILES[h.id]
    if mat==4 and tuple(s)==(.057,.008,.014):
        side=1 if x>0 else -1
        # Tapered continuous brow silhouette; no five disconnected beads.
        for k in range(7):
            t=(k-3)/3;dx=t*.026*eye
            yy=y+tilt*side*dx+.004*(1-t*t)
            thickness=.0025+.0017*(1-abs(t))
            h.ell(4,joint,(x+dx,yy,face_depth(h,x+dx,yy)+.0015),(.0065,thickness,.0028),8,4)
        return True
    if mat==8 and tuple(s)==(.045,.006,.009):
        front=face_depth(h,0,y)
        h.ell(8,joint,(0,y,front+.001),(.023*mouth,.0026,.003),12,4)
        h.ell(h.lip_index,joint,(0,y-.005,front+.002),(.020*mouth,.004,.004),12,4)
        return True
    return False

def add_details(h,result):
    _,_,_,head,arms,_,_=result
    # Nasal bridge and nostril wings, skinned to the original head joint.
    _,_,_,nose,_=PROFILES[h.id];y=1.764*h.h
    h.ell(3,head,(0,y,face_depth(h,0,y)+.002),(.010*nose,.028,.015),12,6)
    y=1.736*h.h
    for s in (-1,1):
        x=s*.012*nose;h.ell(3,head,(x,y,face_depth(h,x,y)+.008),(.009,.009,.011),10,5)
    # Model eyelid rims on the existing head, following the sculpted surface.
    # The inset eye remains a separate material, with an unobtrusive catchlight.
    _,tilt,eye,_,mouth=PROFILES[h.id]
    for side in (-1,1):
        cx=side*.050*(1.01 if h.face=='round' else .97);cy=1.775*h.h
        for upper in (True,False):
            def rim(u,v):
                t=2*u-1
                xx=cx+t*.027*eye
                yy=cy+side*tilt*t*.008+(1 if upper else -1)*.009*math.sin(math.pi*u)
                zz=face_depth(h,xx,yy)+.0035
                radius=(.0024 if upper else .0017)*(.55+.45*math.sin(math.pi*u))
                angle=2*math.pi*v;ny,nz=math.cos(angle),math.sin(angle)
                return (xx,yy+radius*ny,zz+radius*nz),(0,ny,nz),(head,head,1.)
            _grid(h,3,rim,8 if getattr(h,'mobile_lod',False) else 16,6)
        h.ell(5,head,(cx-.0028,cy+.003,face_depth(h,cx,cy)+.010),(.0022,.0022,.0015),6,3)
    # Distinct raised detail on the existing canonical hand-held equipment.
    hand=arms[1][2];x,y,z=h.rest[hand];c=(x+.025,y-.025,z+.05)
    def at(dx,dy,dz):return (c[0]+dx,c[1]+dy,c[2]+dz)
    def jewel(dx,dy,dz,r=.015):h.ell(1,hand,at(dx,dy,dz),(r,r,r*.55),8,4)
    gear=h.gear
    if gear=='mallet':
        for dx in (-.12,0,.12):jewel(dx,.35,.086,.027)
    elif gear=='compass':
        for k in range(8):
            a=k*math.pi/4;jewel(.155*math.cos(a),.155*math.sin(a),.041,.011)
    elif gear=='shield':
        for dx,dy in ((-.15,.19),(.20,.19),(-.15,.06),(.20,.06),(.025,-.15)):jewel(dx,dy,.123,.024)
    elif gear=='banner':
        for dy in (.30,.40,.50):jewel(.16,dy,.032,.023)
    elif gear=='tambourine':
        for k in range(8):
            a=k*math.pi/4;jewel(.17*math.cos(a),.17*math.sin(a),.040,.014)
    elif gear=='cuff':
        for dx in (-.056,.056):jewel(dx,0,.175,.013)
    elif gear=='crook':
        for dy in (-.35,-.22,.22,.35):jewel(0,dy,.038,.015)
    elif gear=='radio':
        for dx in (-.035,0,.035):jewel(dx,-.065,.049,.012)
    elif gear=='caddy':
        for dx in (-.08,0,.08):jewel(dx,-.04,.104,.022)
    elif gear=='loudhailer':
        for dx in (-.09,.09):jewel(dx,.15,.068,.020)
    elif gear=='ledger':
        for dy in (-.10,0,.10):jewel(-.09,dy,.059,.013)
    elif gear=='trowel':
        for dy in (.24,.32,.39):jewel(0,dy,.055,.016)
    elif gear=='puppet':
        for dx in (-.04,.04):jewel(dx,.12,.067,.013)
    else:raise ValueError('Unknown canonical equipment: '+gear)
