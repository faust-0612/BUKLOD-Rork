"""Secondary hair rig for original review candidates, without changing core bone indices."""
def tip_weight(y,z,height,style):
    if style=='hood' or z>=-.025:return 0.
    if style in ('long','ponytail'):
        t=max(0.,min(1.,(1.82-y/height)/.26))
    else:
        t=max(0.,min(1.,(y/height-1.88)/.14))*.45
    return t*t*(3-2*t)

def attach_hair(h,head):
    if h.hair=='hood':return
    # Append after the canonical rig: existing bone indices remain unchanged.
    g=h.geo[4]
    weights=[tip_weight(p[1],p[2],h.h,h.hair) if j[0]==head and w[0]>.999 else 0.
             for p,j,w in zip(g['p'],g['j'],g['w'])]
    if not any(w>.001 for w in weights):raise ValueError('No movable hair vertices: '+h.id)
    pivot=(0,1.82*h.h,-.07)
    offset=tuple(pivot[i]-h.rest[head][i] for i in range(3))
    joint=h.bone('ReviewHair',head,offset)
    for i,w in enumerate(weights):
        if w>0:
            g['j'][i]=(head,joint,0,0)
            g['w'][i]=(1-w,w,0.,0.)
