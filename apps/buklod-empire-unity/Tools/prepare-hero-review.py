#!/usr/bin/env python3
"""Refine existing original procedural hero candidates, without modifying MAIN or approving them."""
import copy, importlib.util, json, pathlib, hashlib
from skill_motions import add_skill_motions
from refine_surfaces import texture_glb
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
    def ell(self,mat,joint,center,size,segments=12,steps=6):
        # The original chest emblem is distinct from weapon glow and other trim.
        if mat==7 and tuple(size)==(.032,.044,.017):
            mat=self.stone_index
            self.stone_count+=1
        # Smooth only rounded surfaces, leaving deliberately faceted armor and gems intact.
        if mat not in (0,1,7,self.stone_index):
            segments=max(segments,16);steps=max(steps,8)
        g=self.geo[mat];start=len(g['p'])
        super().ell(mat,joint,center,size,segments,steps)
        if mat not in (0,1,7,self.stone_index):
            for i in range(start,len(g['p'])):
                p=g['p'][i]
                g['n'][i]=original.norm(tuple((p[k]-center[k])/(size[k]**2) for k in range(3)))
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
        return result
def main():
    out=root/"Tools/ReviewOutput/heroes"
    out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for hero_id,profile in original.HEROES.items():
        h=Candidate(hero_id,profile)
        path=out/(hero_id+".glb")
        row=h.export(path)
        texture_glb(path)
        row['clips']=add_skill_motions(path,hero_id)
        row['sha256']=hashlib.sha256(path.read_bytes()).hexdigest()
        row['bytes']=path.stat().st_size
        row['surfaceRevision']='original-procedural-pbr-v2'
        assert h.stone_count==1 and len(row["clips"])==12 and row["bones"]>0
        row["stone"]=stone_by[hero_id]["stone"]
        row["sourceGeneratorSha256"]=hashlib.sha256(source.read_bytes()).hexdigest()
        rows.append(row)
    assert len(rows)==13 and len({r["meshHash"] for r in rows})==13
    (out/"manifest.json").write_text(json.dumps({"status":"RIGGED_PROCEDURAL_REVIEW_ONLY","premiumVerified":False,"heroes":rows},indent=2)+"\n")
    print("Prepared 13 independent rigged hero candidates; not likeness-approved.")
if __name__=="__main__":main()
