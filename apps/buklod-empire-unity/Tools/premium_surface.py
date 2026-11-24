"""Original high-fidelity material tiles; dependency-free and deterministic."""
import math
from functools import lru_cache
SIZE=256

def byte(v): return max(0,min(255,round(v)))
def noise(x,y):
    n=((x%SIZE)*374761393+(y%SIZE)*668265263)&0xffffffff
    n=((n^(n>>13))*1274126177)&0xffffffff
    return (n^(n>>16))/4294967295

@lru_cache(maxsize=12)
def surface(kind):
    def height(x,y):
        u=2*math.pi*x/SIZE;v=2*math.pi*y/SIZE;n=noise(x,y)-.5
        if kind in ('armor','trim'):return .5+.08*math.sin(32*u+.2*math.sin(4*v))+.05*math.sin(8*v)+.04*n
        if kind=='fabric':return .5+.22*math.sin(32*u)*math.cos(32*v)+.06*n
        if kind=='hair':return .5+.22*math.sin(24*u+.4*math.sin(4*v))+.035*n
        if kind=='leather':return .5+.09*math.sin(12*u+2*math.sin(8*v))*math.cos(12*v)+.14*n
        return .5+.04*math.sin(16*u)*math.cos(16*v)+.025*n
    heights=[[height(x,y) for x in range(SIZE)] for y in range(SIZE)]
    base=[];mr=[];normal=[]
    strength={'armor':.65,'trim':.45,'fabric':.8,'hair':.65,'leather':.7}.get(kind,.16)
    for y in range(SIZE):
        for x in range(SIZE):
            h=heights[y][x];v=byte(214+48*h)
            base.append((v,v,v))
            mr.append((255,byte(255-(1-h)*({'armor':72,'trim':58,'fabric':18,'leather':36,'hair':35}.get(kind,16))),255))
            dx=(heights[y][(x+1)%SIZE]-heights[y][(x-1)%SIZE])*strength
            dy=(heights[(y+1)%SIZE][x]-heights[(y-1)%SIZE][x])*strength
            length=math.sqrt(dx*dx+dy*dy+1)
            normal.append(tuple(byte((q/length*.5+.5)*255) for q in (-dx,-dy,1)))
    return base,mr,normal

def tangent(n,axes):
    u=[float(k==axes[0]) for k in range(3)];v=[float(k==axes[1]) for k in range(3)]
    dot=sum(a*b for a,b in zip(u,n));t=[u[k]-dot*n[k] for k in range(3)]
    length=math.sqrt(sum(a*a for a in t))
    if length<1e-6:
        t=[n[1]*v[2]-n[2]*v[1],n[2]*v[0]-n[0]*v[2],n[0]*v[1]-n[1]*v[0]]
        length=math.sqrt(sum(a*a for a in t))
    if length<1e-6:raise ValueError('Degenerate tangent')
    t=[a/length for a in t]
    c=[n[1]*t[2]-n[2]*t[1],n[2]*t[0]-n[0]*t[2],n[0]*t[1]-n[1]*t[0]]
    return (*t,1. if sum(a*b for a,b in zip(c,v))>=0 else -1.)
