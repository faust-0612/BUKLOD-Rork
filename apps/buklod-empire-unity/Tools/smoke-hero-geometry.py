"""Geometry-only smoke for all 13 full and LOD candidates, no network or Unity.
Uses the real Candidate export and signature motion authoring. Does not alter
ReviewOutput, production assets or the approved resolution policy.
"""
import hashlib, importlib.util, json, pathlib, sys, tempfile
from validate_skill_motions import validate_hero
from prepare_hero_lod import inspect

TOOLS=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('hero_smoke',TOOLS/'prepare-hero-review.py')
hero=importlib.util.module_from_spec(spec)
spec.loader.exec_module(hero)

def validate_geometry(h):
    count=0;hair=None
    for i,node in enumerate(h.nodes):
        if node.get('name')=='ReviewHair':hair=i
    expected=h.hair!='hood'
    if (hair is not None)!=expected:raise ValueError('Hair rig mismatch '+h.id)
    movable=0
    for material,g in h.geo.items():
        n=len(g['p'])
        if not n or any(len(g[key])!=n for key in ('n','j','w')) or n%3 or g['i']!=list(range(n)):
            raise ValueError('Geometry attribute/index mismatch '+h.id)
        for joints,weights in zip(g['j'],g['w']):
            if any(not 0<=j<len(h.joints) for j in joints) or any(not 0<=w<=1 for w in weights) or abs(sum(weights)-1)>1e-6 or any(a<b for a,b in zip(weights,weights[1:])):
                raise ValueError('Skin influence mismatch '+h.id)
            if hair is not None:
                for j,w in zip(joints,weights):
                    if j==hair and w>0:
                        if material!=4:raise ValueError('Hair affects nonhair surface '+h.id)
                        movable+=1
        count+=n//3
    if expected and not movable:raise ValueError('Unweighted hair rig '+h.id)
    return count,movable

def main():
    rows=[];signatures=set()
    with tempfile.TemporaryDirectory(prefix='buklod-geometry-smoke-') as tmp:
        folder=pathlib.Path(tmp)
        for id,profile in hero.original.HEROES.items():
            entries=[]
            for low in (False,True):
                h=hero.Candidate(id,profile);h.mobile_lod=low
                path=folder/(id+('-lod' if low else '-full')+'.glb')
                row=h.export(path)
                triangles,movable=validate_geometry(h)
                if triangles!=row['triangles'] or h.stone_count!=1:raise ValueError('Export accounting mismatch '+id)
                hero.add_skill_motions(path,id)
                data=path.read_bytes();motions=validate_hero(data,id)
                entries.append((inspect(data),motions,triangles,movable))
                path.unlink()
            full,low=entries
            if full[0][:5]!=low[0][:5] or full[1]!=low[1]:raise ValueError('Full and LOD rig or skill divergence '+id)
            if low[2]>=full[2]*.8:raise ValueError('LOD reduction insufficient '+id)
            if signatures.intersection(full[1].values()):raise ValueError('Duplicate hero skill motion '+id)
            signatures.update(full[1].values())
            rows.append({'id':id,'fullTriangles':full[2],'lodTriangles':low[2],'hairVertices':full[3],'lodHairVertices':low[3]})
            print('Geometry smoke PASS',id,full[2],low[2],flush=True)
    if len(rows)!=13 or len(signatures)!=39:raise ValueError('Incomplete smoke roster')
    print('BUKLOD_GEOMETRY_SMOKE_PASS',json.dumps({'heroes':rows,'skillMotions':len(signatures),'textureQualityVerified':False,'unityVerified':False}),flush=True)
if __name__=='__main__':main()
