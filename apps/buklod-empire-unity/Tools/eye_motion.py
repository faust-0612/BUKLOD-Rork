"""Independent eye apertures on the existing head; no jaw or facial morph targets."""
from identity_detail import face_depth

def attach_eyes(h,head):
    eyes={}
    for side,label in ((-1,'L'),(1,'R')):
        x=side*.050*(1.01 if h.face=='round' else .97)
        y=1.775*h.h
        z=face_depth(h,x,y)+.0035
        offset=tuple(a-b for a,b in zip((x,y,z),h.rest[head]))
        eyes[side]=h.bone('ReviewEye_'+label,head,offset)
    # Existing whites, iris and catchlights are separate material groups.
    for mat in (5,6):
        g=h.geo[mat]
        for i,p in enumerate(g['p']):
            if g['j'][i][0]!=head:continue
            j=eyes[1 if p[0]>0 else -1]
            g['j'][i]=(j,0,0,0);g['w'][i]=(1.,0.,0.,0.)
    return eyes
