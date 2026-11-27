#!/usr/bin/env python3
"""Refine existing original procedural hero candidates, without modifying MAIN or approving them."""
import argparse, copy, importlib.util, json, pathlib, hashlib
from skill_motions import add_skill_motions
from identity_detail import adjust_feature, sculpt_surface, replace_face_box, add_details
from refine_surfaces import texture_glb
from hd_surface import review_size
from fidelity_geometry import add_fidelity_geometry
from joint_geometry import add_joint_geometry
from hair_motion import attach_hair
from eye_motion import attach_eyes
from sculpt_geometry import bevel_plate, REVISION
root=pathlib.Path(__file__).resolve().parents[1]
repo=root.parents[1]
source=repo/"scripts/generate-buklod-empire-hero-glbs.py"
spec=importlib.util.spec_from_file_location("buklod_original_hero_generator",source)
original=importlib.util.module_from_spec(spec)
spec.loader.exec_module(original)
stones=json.loads((root/"Assets/Resources/SacredStones.json").read_text())["stones"]
stone_by={r["heroId"]:r for r in stones}
assert set(stone_by)==set(original.HEROES)
# Six owner design sheets reviewed: Phan green/gold, Quin cyan/steel, Van blue/gold,
# Christian red/gold, Lhen violet, Ace silver/teal. Other profiles remain canonical.
colors={"phan":("385c2a","c5a65b","253b22"),"quin":("27676f","a8d5d8","183d48"),
        "van":("234c8a","d2b36a","1e3054"),"christian":("943d3e","e9bf65","442632"),
        "lhen":("8051a8","e6a9dd","3f285c"),"ace":("b7c4c8","3bbfb3","364958")}
class Candidate(original.Hero):
    review_geometry_limits=(24000,5_000_000)
    def __init__(self,hero_id,profile):
        p=list(profile)
        if hero_id in colors:p[:3]=colors[hero_id]
        super().__init__(hero_id,tuple(p))
        row=stone_by[hero_id]
        stone=copy.deepcopy(self.materials[7])
        rgb=original.rgba(row["color"].lstrip("#"))
        stone["name"]="SacredStone_"+row["stone"]
        stone["pbrMetallicRoughness"]["baseColorFactor"]=rgb
        stone["emissiveFactor"]=[x*.18 for x in rgb[:3]]
        self.stone_index=len(self.materials)
        self.materials.append(stone)
        self.stone_count=0
        lip=copy.deepcopy(self.materials[3]);lip["name"]="lip";lip["pbrMetallicRoughness"]["baseColorFactor"]=original.rgba("986451")
        self.lip_index=len(self.materials);self.materials.append(lip)
    def ell(self,mat,joint,center,size,segments=12,steps=6):
        # The original chest emblem is distinct from weapon glow and other trim.
        if mat==7 and tuple(size)==(.032,.044,.017):
            mat=self.stone_index
            self.stone_count+=1
        center,size=adjust_feature(self,mat,joint,center,size)
        # Smooth only rounded surfaces, leaving deliberately faceted armor and gems intact.
        if mat not in (0,1,7,self.stone_index) and not (self.nodes[joint]["name"]=="Head" and max(size)<.04):
            segments=max(segments,16);steps=max(steps,8)
        if not getattr(self,'mobile_lod',False) and self.nodes[joint]["name"]=="Head" and max(size)>.08 and mat not in (0,1,7,self.stone_index):
            segments=max(segments,28);steps=max(steps,14)
        if getattr(self,'mobile_lod',False):
            segments=max(6,min(segments,8));steps=max(3,min(steps,4))
        g=self.geo[mat];start=len(g['p'])
        super().ell(mat,joint,center,size,segments,steps)
        if mat not in (0,1,7,self.stone_index):
            for i in range(start,len(g['p'])):
                p=g['p'][i]
                g['n'][i]=original.norm(tuple((p[k]-center[k])/(size[k]**2) for k in range(3)))
        sculpt_surface(self,mat,joint,center,size,start)
    def plate(self,mat,joint,center,outline,depth=.035):
        if mat in (0,1) and not getattr(self,'mobile_lod',False) and bevel_plate(self,mat,joint,center,outline,depth):return
        super().plate(mat,joint,center,outline,depth)
    def box(self,mat,joint,c,s):
        if not replace_face_box(self,mat,joint,c,s):super().box(mat,joint,c,s)
    def make(self):
        result=super().make()
        _,pelvis,chest,head,arms,legs,_=result
        # Raised rivets and layered trim, anchored to the existing independent rigs.
        for side in (-1,1):
            for j in range(3):
                self.ell(1,chest,(side*.125*self.w,(1.16+j*.065)*self.h,.178),(.012,.012,.009),6,3)
        for (_,fore,_),(_,shin,_) in zip(arms,legs):
            for j in range(2):
                x,y,z=self.rest[fore]
                self.plate(1,fore,(x,y-(.08+j*.065)*self.h,z+.082),[(-.05,0),(0,.02),(.05,0),(0,-.02)],.008)
                x,y,z=self.rest[shin]
                self.plate(1,shin,(x,y-(.09+j*.075)*self.h,z+.082),[(-.055,0),(0,.023),(.055,0),(0,-.023)],.009)
        eyes=attach_eyes(self,head)
        add_details(self,result,eyes)
        add_fidelity_geometry(self,result)
        self.joint_triangles=add_joint_geometry(self,result)
        attach_hair(self,head)
        return result
def pipeline_hash():
    paths=json.loads((root/'Tools/hero-pipeline-inputs.json').read_text())
    return hashlib.sha256(b''.join(hashlib.sha256((root/p).read_bytes()).digest() for p in paths)).hexdigest()
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--hero",choices=tuple(original.HEROES),help="Isolated single-hero material/portrait review; does not overwrite roster.")
    args=parser.parse_args()
    resolution=review_size()
    out=(root/"Tools/ReviewOutput/hd-portraits"/str(resolution)/args.hero) if args.hero else root/"Tools/ReviewOutput/heroes"
    out.mkdir(parents=True,exist_ok=True)
    rows=[]
    pipeline=pipeline_hash()
    profiles=[(args.hero,original.HEROES[args.hero])] if args.hero else original.HEROES.items()
    for hero_id,profile in profiles:
        h=Candidate(hero_id,profile)
        path=out/(hero_id+".glb")
        row=h.export(path)
        texture_glb(path)
        row['clips']=add_skill_motions(path,hero_id)
        row['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        row['bytes']=path.stat().st_size
        row['textureResolution']=review_size()
        row['geometryRevision']=REVISION
        row['jointTriangles']=h.joint_triangles
        row['surfaceRevision']='original-procedural-pbr-v5-hd' if review_size()>256 else 'original-procedural-pbr-v4-fidelity'
        assert h.stone_count==1 and len(row["clips"])==12 and row["bones"]>0
        row["stone"]=stone_by[hero_id]["stone"]
        row["sourceGeneratorSha256"]=hashlib.sha256(source.read_bytes()).hexdigest()
        row["sourcePipelineSha256"]=pipeline
        rows.append(row)
    expected=1 if args.hero else 13
    assert len(rows)==expected and len({r["meshHash"] for r in rows})==expected
    (out/"manifest.json").write_text(json.dumps({"status":"RIGGED_PROCEDURAL_REVIEW_ONLY","premiumVerified":False,"heroes":rows},indent=2)+"\n")
    print(f"Prepared {expected} independent rigged hero candidate(s) at {resolution}px; not likeness-approved.")
if __name__=="__main__":main()
