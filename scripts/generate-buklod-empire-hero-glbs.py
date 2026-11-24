#!/usr/bin/env python3
"""Deterministic, original BUKLOD mobile hero GLBs. No third-party hero meshes.
Each hero has independently authored shape parameters, armor, hair, gear,
skin, joint hierarchy, and animation channels. Shared authoring code is not
a shared runtime rig. Stylized game assets, not scanned portrait likenesses."""
import argparse, hashlib, json, math, pathlib, struct
from collections import defaultdict
from math import sin, cos, pi
P = pathlib.Path
# armor / trim / fabric, stature, shoulder width, waist, head shape, hair,
# silhouette, weapon, cape, combat cadence. Canonical IDs & items stay intact.
HEROES = {
 "phan":("254a82","c5a65b","172c4b",1.04,1.09,1.02,"square","crest","builder","mallet",True,.91),
 "quin":("2f805e","d5c686","243f35",.96,.83,.82,"oval","ponytail","scout","compass",False,1.22),
 "van":("d5e4e5","70bda8","356a74",1.00,1.08,.96,"round","swept","guardian","shield",True,.99),
 "christian":("943d3e","e9bf65","442632",1.09,1.18,1.04,"square","crest","commander","banner",True,.92),
 "lhen":("9b61b5","e6a9dd","3f285c",.97,.84,.82,"oval","long","bard","tambourine",True,1.12),
 "ace":("e5e3d6","dc5f65","364958",1.02,.98,.94,"round","short","medic","cuff",False,1.05),
 "ellusur":("886c43","f2d28c","58462f",1.12,1.07,1.04,"long","hood","shepherd","crook",True,.82),
 "jawo":("bd6544","eec079","482e32",1.00,1.01,.91,"square","spike","skirmisher","radio",False,1.24),
 "mitch":("35637f","e2a957","293845",1.04,1.22,1.10,"round","short","artisan","caddy",False,.93),
 "niel":("65509a","b8d3ff","302749",1.08,.98,.91,"long","swept","disruptor","loudhailer",True,1.06),
 "angel":("2d8c9b","ebd38f","244852",.98,.85,.83,"oval","long","logistician","ledger",True,1.07),
 "vhen":("567f3c","c7df78","2b4730",.94,.90,.88,"round","hood","grower","trowel",False,1.16),
 "trudice":("a25176","f3cbd7","4d2c52",.96,.82,.81,"oval","ponytail","controller","puppet",True,1.10)
}
CLIPS=("Idle","Walk","Run","Attack","Skill","Ultimate","Hit","Death","Victory")
def rgba(h):
 return [int(h[i:i+2],16)/255 for i in (0,2,4)]+[1]
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def mul(a,s): return tuple(x*s for x in a)
def dot(a,b): return sum(x*y for x,y in zip(a,b))
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def norm(a): return mul(a,1/max(1e-9,math.sqrt(dot(a,a))))
def qaxis(axis,ang):
 s=sin(ang/2); return (*mul(axis,s),cos(ang/2))
def qmul(a,b):
 x,y,z,w=a; X,Y,Z,W=b
 return (w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z)
def quat(x=0,y=0,z=0):
 return qmul(qmul(qaxis((0,0,1),z),qaxis((0,1,0),y)),qaxis((1,0,0),x))
class Hero:
 def __init__(self,id,profile):
  self.id=id
  armor,trim,fabric,self.h,self.w,self.waist,self.face,self.hair,self.role,self.gear,self.cape,self.tempo=profile
  self.materials=[]
  for name,col,metal,rough,em in [
   ("armor",armor,.52,.31,0),("trim",trim,.73,.28,0),("fabric",fabric,.04,.82,0),
   ("skin","c79872",0,.76,0),("hair","251c22",.02,.65,0),("eye","ddd8ce",0,.4,0),
   ("pupil","241f29",0,.43,0),("glow",trim,.16,.28,.24),("leather","322c32",.03,.72,0)]:
   m={"name":name,"pbrMetallicRoughness":{"baseColorFactor":rgba(col),"metallicFactor":metal,"roughnessFactor":rough}}
   if em:m["emissiveFactor"]=[x*em for x in rgba(col)[:3]]
   self.materials.append(m)
  self.geo=defaultdict(lambda: {"p":[],"n":[],"j":[],"w":[],"i":[]})
  self.nodes=[]; self.joints=[]; self.rest=[]
  self.b=bytearray(); self.views=[]; self.accessors=[]
 def bone(self,name,parent,pos):
  idx=len(self.nodes); glob=pos if parent is None else add(self.rest[parent],pos)
  self.nodes.append({"name":name,"translation":list(pos)})
  self.rest.append(glob); self.joints.append(idx)
  if parent is not None:self.nodes[parent].setdefault("children",[]).append(idx)
  return idx
 def tri(self,mat,joint,pts):
  g=self.geo[mat]; k=len(g["p"])
  n=norm(cross(sub(pts[1],pts[0]),sub(pts[2],pts[0])))
  if dot(n,n)<.1:return
  for p in pts:g["p"].append(p);g["n"].append(n);g["j"].append((joint,0,0,0));g["w"].append((1.,0.,0.,0.))
  g["i"].extend((k,k+1,k+2))
 def loft(self,mat,joint,center,rings,segments=12,phase=0):
  # Rings (height, x radius, z radius); flattened facets give readable armor.
  # Outward-facing winding, caps, independent profiles.
  rows=[]
  for y,rx,rz in rings:
   rows.append([add(center,(rx*cos(2*pi*i/segments+phase),y,rz*sin(2*pi*i/segments+phase))) for i in range(segments)])
  for row in range(len(rows)-1):
   for i in range(segments):
    k=(i+1)%segments
    a,b,c,d=rows[row][i],rows[row+1][i],rows[row+1][k],rows[row][k]
    self.tri(mat,joint,[a,b,c]); self.tri(mat,joint,[a,c,d])
  for row,reverse in ((0,False),(-1,True)):
   cy=(center[0],center[1]+rings[row][0],center[2])
   for i in range(segments):
    p,q=rows[row][i],rows[row][(i+1)%segments]
    self.tri(mat,joint,[cy,q,p] if reverse else [cy,p,q])
 def ell(self,mat,joint,center,size,segments=12,steps=6):
  rings=[(size[1]*sin(-pi/2+pi*k/steps),max(.0008,size[0]*cos(-pi/2+pi*k/steps)),max(.0008,size[2]*cos(-pi/2+pi*k/steps))) for k in range(steps+1)]
  self.loft(mat,joint,center,rings,segments)
 def box(self,mat,joint,c,s):
  x,y,z=[v/2 for v in s]; p=[add(c,t) for t in ((-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z))]
  for a,b,c,d in ((0,3,2,1),(4,5,6,7),(0,4,7,3),(1,2,6,5),(0,1,5,4),(3,7,6,2)):
   self.tri(mat,joint,[p[a],p[b],p[c]]);self.tri(mat,joint,[p[a],p[c],p[d]])
 def plate(self,mat,joint,center,outline,depth=.035):
  # Faceted extruded custom silhouette in the XY plane, with metallic edge.
  # Canonical counter-clockwise front winding regardless of hand-authored outline.
  if sum(outline[i][0]*outline[(i+1)%len(outline)][1]-outline[(i+1)%len(outline)][0]*outline[i][1] for i in range(len(outline)))<0:outline=list(reversed(outline))
  front=[add(center,(x,y,depth)) for x,y in outline]; back=[add(center,(x,y,-depth)) for x,y in outline]
  mid=add(center,(0,0,depth+.015))
  for i in range(len(front)):
   k=(i+1)%len(front); self.tri(mat,joint,[mid,front[i],front[k]])
   self.tri(mat,joint,[front[i],back[i],back[k]]);self.tri(mat,joint,[front[i],back[k],front[k]])
   self.tri(mat,joint,[center,back[k],back[i]])
 def make(self):
  h,w,wa=self.h,self.w,self.waist
  H=lambda y:y*h
  root=self.bone("Root",None,(0,0,0))
  pelvis=self.bone("Pelvis",root,(0,H(.91),0))
  chest=self.bone("Chest",pelvis,(0,H(.29),0))
  neck=self.bone("Neck",chest,(0,H(.29),0))
  head=self.bone("Head",neck,(0,H(.12),0))
  arms=[];legs=[]
  for sign,label in ((-1,"L"),(1,"R")):
   upper=self.bone("UpperArm_"+label,chest,(sign*.24*w,H(.21),0))
   fore=self.bone("Forearm_"+label,upper,(sign*.08*w,H(-.30),0))
   hand=self.bone("Hand_"+label,fore,(0,H(-.25),0))
   thigh=self.bone("Thigh_"+label,pelvis,(sign*.115*wa,H(-.07),0))
   shin=self.bone("Shin_"+label,thigh,(0,H(-.38),0))
   foot=self.bone("Foot_"+label,shin,(0,H(-.33),0))
   arms.append((upper,fore,hand));legs.append((thigh,shin,foot))
  mantle=self.bone("Mantle",chest,(0,H(.23),-.13))
  self.ell(2,pelvis,(0,H(.96),0),(.20*wa,H(.18),.125))
  self.loft(0,chest,(0,H(1.16),0),[(H(-.17),.16*wa,.12),(H(-.02),.18*wa,.135),(H(.15),.245*w,.16),(H(.28),.19*w,.135)],12,pi/12)
  self.loft(1,pelvis,(0,H(.99),0),[(-.035,.18*wa,.145),(.04,.19*wa,.15)],12)
  self.plate(0,chest,(0,H(1.32),.146),[(-.18*w,.12),(-.22*w,-.02),(-.1*w,-.14),(0,-.19),(.1*w,-.14),(.22*w,-.02),(.18*w,.12)],.028)
  self.plate(1,chest,(0,H(1.34),.184),[(-.055,.065),(-.085,0),(0,-.09),(.085,0),(.055,.065)],.009)
  self.ell(7,chest,(0,H(1.34),.214),(.032,.044,.017),8,4)
  for s in [-1,1]:
   for i in range(3):
    self.plate(1,chest,(s*.11*w,H(1.14+i*.055),.147),[(-.055,-.018),(.07,-.024),(.08,.017),(-.045,.028)],.01)
  self.ell(3,neck,(0,H(1.51),0),(.068,.10,.065))
  face_w={"square":.135,"oval":.113,"round":.135,"long":.115}[self.face]
  face_h={"square":.154,"oval":.166,"round":.15,"long":.178}[self.face]*h
  fc=(0,H(1.76),0)
  self.ell(3,head,fc,(face_w,face_h,.119),16,8)
  self.ell(4,head,(0,H(1.84),-.033),(face_w*1.09,.113*h,.117),14,5)
  for s in [-1,1]:
   self.ell(3,head,(s*face_w,H(1.755),0),(.028,.045,.025),8,4)
   self.ell(5,head,(s*.050,H(1.775),.109),(.027,.011,.011),10,4)
   self.ell(6,head,(s*.050,H(1.775),.120),(.009,.009,.006),8,4)
   self.box(4,head,(s*.049,H(1.802),.113),(.057,.008,.014))
  self.ell(3,head,(0,H(1.748),.121),(.019,.028,.027),8,4)
  self.box(8,head,(0,H(1.709),.111),(.045,.006,.009))
  if self.hair in ("long","ponytail"):
   for s in [-1,1]:
    self.loft(4,head,(s*.102,H(1.63),-.025),[(-.12,.035,.042),(.10,.050,.056),(.20,.032,.038)],8)
   if self.hair=="ponytail":self.ell(4,head,(0,H(1.67),-.145),(.066,.19,.069),10)
  elif self.hair=="hood":
   self.loft(2,head,(0,H(1.79),-.035),[(-.135,.145,.115),(.05,.153,.13),(.19,.045,.045)],10)
   # front face stays visible; hood rear and sides form a recognizable profile
   self.ell(3,head,(0,H(1.755),.075),(.105,.131,.075),14)
  else:
   for i in range(5):
    self.loft(4,head,((i-2)*.041,H(1.855),-.005),[(0,.045,.065),(.09+(.03 if self.hair=="spike" else 0)*(i%2),.016,.025)],7)
   if self.hair=="crest":self.plate(1,head,(0,H(1.94),.012),[(-.085,-.03),(.0,.12),(.085,-.03)],.028)
  for i,s in enumerate((-1,1)):
   u,f,hand=arms[i]; t,sh,foot=legs[i]
   shoulder=self.rest[u]; elbow=self.rest[f]; wrist=self.rest[hand]
   shoulder_radius=.14*w*(1.2 if self.role in ("guardian","commander","artisan") else .9)
   self.ell(0,u,add(shoulder,(s*.018,-.035,0)),(shoulder_radius,.12*h,.115),10,5)
   self.plate(1,u,add(shoulder,(s*.028,-.02,.098)),[(-.09,-.06),(.09,-.06),(.10,.04),(0,.09),(-.10,.04)],.022)
   self.loft(2,u,add(shoulder,(s*.035,-.15*h,0)),[(-.13,.061,.065),(.11,.082,.075)],10)
   self.loft(0,f,add(elbow,(0,-.13*h,0)),[(-.10,.072,.074),(.03,.093,.085),(.12,.076,.072)],10)
   self.loft(1,f,add(elbow,(0,-.19*h,0)),[(-.022,.079,.079),(.022,.079,.079)],10)
   self.ell(8,hand,add(wrist,(0,-.045,0)),(.065,.075,.064),10,5)
   hip=self.rest[t]; knee=self.rest[sh]; ankle=self.rest[foot]
   self.loft(2,t,add(hip,(0,-.17*h,0)),[(-.17,.073,.08),(.14,.096*wa,.10)],10)
   self.plate(0,t,add(hip,(0,-.18*h,.084)),[(-.075,.13),(.075,.13),(.09,-.08),(0,-.16),(-.09,-.08)],.026)
   self.ell(1,sh,add(knee,(0,-.035,.055)),(.085,.086,.063),10,4)
   self.loft(0,sh,add(knee,(0,-.19*h,0)),[(-.13,.075,.077),(.12,.095,.085)],10)
   self.ell(8,foot,add(ankle,(0,-.06*h,.05)),(.087,.080,.151),12,5)
   self.box(1,foot,add(ankle,(0,-.093*h,.067)),(.16,.037,.24))
  # Distinct armor skirt / cape / functional signature gear.
  for s in [-1,1]:
   self.plate(0,pelvis,(s*.13*wa,H(.88),.105),[(-.085,.11),(.085,.11),(.10,-.10),(0,-.18),(-.10,-.10)],.024)
  if self.cape:
   top=H(1.46); bottom=H(.62 if self.role in ("commander","shepherd") else .85)
   for i in range(6):
    l=-.24*w+i*.48*w/6; rr=l+.48*w/6
    pts=[(l,top,-.145),(rr,top,-.145),(rr*1.4,bottom,-.22-.025*(i%2)),(l*1.4,bottom,-.22-.025*((i+1)%2))]
    for a,b,c in ((0,1,2),(0,2,3)):
     self.tri(2,mantle,[pts[a],pts[b],pts[c]]);self.tri(2,mantle,[pts[c],pts[b],pts[a]])
   self.box(1,mantle,(0,bottom,-.225),(.65*w,.034,.045))
  hand=arms[1][2]; c=add(self.rest[hand],(.025,-.025,.05))
  def pole(length=.60):
   self.loft(8,hand,c,[(-length*.48,.034,.034),(length*.52,.035,.035)],8)
   self.loft(1,hand,c,[(-.05,.044,.044),(.055,.044,.044)],8)
  if self.gear=="mallet":
   pole(.66);self.box(0,hand,add(c,(0,.35,0)),(.35,.17,.16));self.box(1,hand,add(c,(0,.42,0)),(.39,.036,.19))
  elif self.gear=="compass":
   self.ell(1,hand,c,(.18,.18,.042),16);self.ell(0,hand,add(c,(0,0,.04)),(.145,.145,.015),16)
   self.plate(7,hand,add(c,(0,0,.059)),[(0,.13),(-.024,0),(0,-.13),(.024,0)],.009)
  elif self.gear=="shield":
   self.plate(0,hand,add(c,(.025,.06,.06)),[(-.20,.22),(.20,.22),(.22,.01),(0,-.29),(-.22,.01)],.055)
   self.plate(1,hand,add(c,(.025,.06,.12)),[(-.05,.13),(.05,.13),(.09,.0),(0,-.12),(-.09,0)],.012)
  elif self.gear=="banner":
   pole(.94);self.plate(2,hand,add(c,(.16,.45,0)),[(-.13,.22),(.17,.19),(.17,-.15),(.0,-.09),(-.13,-.15)],.014)
   self.box(1,hand,add(c,(.16,.61,0)),(.31,.035,.035))
  elif self.gear=="tambourine":
   for i in range(16):
    t=2*pi*i/16; self.ell(1,hand,add(c,(.17*cos(t),.17*sin(t),0)),(.045,.045,.038),8,4)
   self.ell(2,hand,c,(.15,.15,.018),16)
  elif self.gear=="cuff":
   self.loft(2,hand,c,[(-.075,.115,.095),(.075,.115,.095)],12)
   self.box(0,hand,add(c,(0,0,.13)),(.16,.13,.075));self.box(7,hand,add(c,(0,.01,.18)),(.098,.05,.009))
  elif self.gear=="crook":
   pole(1.04)
   for i in range(8):
    t=pi*i/7;self.ell(1,hand,add(c,(.12*(1-cos(t)),.53+.12*sin(t),0)),(.038,.038,.038),8,4)
  elif self.gear=="radio":
   self.box(8,hand,c,(.14,.24,.09));self.box(7,hand,add(c,(0,.035,.05)),(.085,.06,.009))
   self.box(1,hand,add(c,(.045,.18,0)),(.026,.16,.026))
  elif self.gear=="caddy":
   self.box(0,hand,c,(.25,.20,.20));self.box(1,hand,add(c,(0,.13,0)),(.20,.035,.035))
   for i in range(3):self.box(8,hand,add(c,((i-1)*.066,.10,0)),(.035,.22,.035))
  elif self.gear=="loudhailer":
   self.loft(0,hand,c,[(-.16,.055,.055),(.03,.08,.08),(.22,.17,.17)],12)
   self.ell(7,hand,add(c,(0,.22,0)),(.145,.025,.145),12)
  elif self.gear=="ledger":
   self.box(2,hand,c,(.24,.31,.08));self.box(1,hand,add(c,(0,0,.046)),(.21,.29,.015))
   for i in range(3):self.box(0,hand,add(c,(0,.07-i*.067,.059)),(.14,.012,.012))
  elif self.gear=="trowel":
   pole(.42);self.plate(0,hand,add(c,(0,.28,.02)),[(-.13,-.10),(.13,-.10),(.10,.08),(0,.20),(-.10,.08)],.025)
  else:
   pole(.34);self.ell(3,hand,add(c,(0,.26,0)),(.085,.09,.07),10)
   self.ell(0,hand,add(c,(0,.11,0)),(.10,.10,.065),10)
  return root,pelvis,chest,head,arms,legs,mantle
 def accessor(self,values,fmt,kind,component,target=None,bounds=False):
  while len(self.b)%4:self.b.append(0)
  offset=len(self.b); flat=[x for v in values for x in (v if isinstance(v,(list,tuple)) else (v,))]
  self.b.extend(struct.pack("<"+fmt*len(flat),*flat))
  v={"buffer":0,"byteOffset":offset,"byteLength":len(self.b)-offset}
  if target:v["target"]=target
  self.views.append(v)
  a={"bufferView":len(self.views)-1,"componentType":component,"count":len(values),"type":kind}
  if bounds:
   seq=[v if isinstance(v,(tuple,list)) else (v,) for v in values]
   a["min"]=[min(x[i] for x in seq) for i in range(len(seq[0]))];a["max"]=[max(x[i] for x in seq) for i in range(len(seq[0]))]
  self.accessors.append(a);return len(self.accessors)-1
 def export(self,path):
  root,pelvis,chest,head,arms,legs,mantle=self.make()
  primitives=[]
  for material,g in sorted(self.geo.items()):
   attrs={"POSITION":self.accessor(g["p"],"f","VEC3",5126,34962,True),"NORMAL":self.accessor(g["n"],"f","VEC3",5126,34962),
    "JOINTS_0":self.accessor(g["j"],"H","VEC4",5123,34962),"WEIGHTS_0":self.accessor(g["w"],"f","VEC4",5126,34962)}
   primitives.append({"attributes":attrs,"indices":self.accessor(g["i"],"H","SCALAR",5123,34963),"material":material})
  # Skin bind matrices for independent per-hero rest geometry.
  matrices=[]
  for x,y,z in self.rest:
   matrices.append((1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1))
  inv=self.accessor(matrices,"f","MAT4",5126)
  self.nodes.append({"name":self.id+"_Mesh","mesh":0,"skin":0})
  animations=[]
  for clip in CLIPS:
   duration={"Idle":1.8,"Walk":.85,"Run":.62,"Attack":.56,"Skill":.85,"Ultimate":1.16,"Hit":.36,"Death":.95,"Victory":1.4}[clip]/self.tempo
   times=[duration*k/8 for k in range(9)]
   time_id=self.accessor(times,"f","SCALAR",5126,bounds=True)
   samplers=[];channels=[]
   for joint in self.joints:
    name=self.nodes[joint]["name"]; keys=[]
    for k in range(9):
     t=k/8; wave=sin(2*pi*t); pulse=sin(pi*t); side=-1 if name.endswith("_L") else 1; x=y=z=0.
     if clip=="Idle":
      if name in ("Chest","Head","Mantle"):x=.03*wave;z=.025*wave
     elif clip in ("Walk","Run"):
      mag=.55 if clip=="Walk" else .83
      if name.startswith(("Thigh","UpperArm")):x=side*wave*mag*(-1 if name.startswith("UpperArm") else 1)
      if name.startswith("Shin"):x=max(0.,side*wave)*mag*.75
      if name.startswith("Forearm"):x=-.22-abs(wave)*.16
      if name=="Chest":x=.09 if clip=="Walk" else .18;y=.07*wave
      if name=="Mantle":x=-.16-.06*wave
     elif clip in ("Attack","Skill","Ultimate"):
      strength={"Attack":1.,"Skill":1.25,"Ultimate":1.5}[clip]
      if name=="Chest":y=sin(2*pi*t)*.48*strength; x=-.10*pulse
      if name=="UpperArm_R":x=-1.35*pulse*strength;z=-.27*pulse
      if name=="Forearm_R":x=-.70*pulse
      if name=="UpperArm_L":x=-.5*pulse;z=.35*pulse if clip!="Attack" else .12*pulse
      if name=="Head":y=-.15*pulse
      if name=="Mantle":x=-.35*pulse
      if self.gear in ("ledger","tambourine","compass","puppet") and name.startswith("UpperArm"):x=-.85*pulse*strength;z=side*.55*pulse
      if self.gear in ("mallet","crook","banner") and name=="UpperArm_R":x=-1.85*pulse;z=-.5*pulse
     elif clip=="Hit":
      if name=="Chest":x=-.35*pulse;z=.15*pulse
      if name=="Head":x=-.18*pulse
     elif clip=="Death":
      if name=="Root":z=pi*.48*t
      if name=="Thigh_L":x=.45*t
     elif clip=="Victory":
      if name.startswith("UpperArm"):z=side*-1.5*pulse;x=-.25*pulse
      if name=="Chest":x=-.12*pulse
     keys.append(quat(x,y,z))
    out=self.accessor(keys,"f","VEC4",5126)
    samplers.append({"input":time_id,"output":out,"interpolation":"LINEAR"})
    channels.append({"sampler":len(samplers)-1,"target":{"node":joint,"path":"rotation"}})
   if clip in ("Walk","Run","Idle"):
    offsets=[(0,(.027 if clip!="Idle" else .008)*sin(pi*k/4)**2,0) for k in range(9)]
    out=self.accessor(offsets,"f","VEC3",5126)
    samplers.append({"input":time_id,"output":out,"interpolation":"LINEAR"})
    channels.append({"sampler":len(samplers)-1,"target":{"node":root,"path":"translation"}})
   animations.append({"name":clip,"samplers":samplers,"channels":channels})
  doc={"asset":{"version":"2.0","generator":"BUKLOD original mobile hero authoring v1"},"scene":0,"scenes":[{"nodes":[root,len(self.nodes)-1]}],"nodes":self.nodes,
   "meshes":[{"name":self.id+"_unique_geometry","primitives":primitives}],"skins":[{"name":self.id+"_independent_skin","joints":self.joints,"skeleton":root,"inverseBindMatrices":inv}],
   "animations":animations,"materials":self.materials,"buffers":[{"byteLength":len(self.b)}],"bufferViews":self.views,"accessors":self.accessors}
  j=json.dumps(doc,separators=(",",":")).encode();j+=b" "*((-len(j))%4);self.b.extend(b"\0"*((-len(self.b))%4))
  blob=struct.pack("<4sII",b"glTF",2,12+8+len(j)+8+len(self.b))+struct.pack("<I4s",len(j),b"JSON")+j+struct.pack("<I4s",len(self.b),b"BIN\0")+self.b
  path.write_bytes(blob)
  tris=sum(len(g["i"])//3 for g in self.geo.values())
  assert 1000<tris<12000 and len(blob)<2_000_000
  return {"id":self.id,"file":path.name,"sha256":hashlib.sha256(blob).hexdigest(),"meshHash":hashlib.sha256(b"".join(struct.pack("<fff",*p) for g in self.geo.values() for p in g["p"])).hexdigest(),"triangles":tris,"bones":len(self.joints),"clips":list(CLIPS),"bytes":len(blob),"signatureEquipment":self.gear}
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--out",required=True);args=ap.parse_args()
 out=P(args.out);out.mkdir(parents=True,exist_ok=True)
 rows=[Hero(id,profile).export(out/(id+".glb")) for id,profile in HEROES.items()]
 assert len({x["meshHash"] for x in rows})==13
 assert sum(x["bytes"] for x in rows)<26*1024*1024
 (out/"manifest.json").write_text(json.dumps({"schema":1,"source":"BUKLOD original procedural stylized models","heroes":rows},indent=2)+"\n")
 print("BUKLOD_13_UNIQUE_RIGGED_MODELS_EXPORTED",json.dumps([{k:x[k] for k in ("id","triangles","bones","bytes")} for x in rows]))
if __name__=="__main__":main()
