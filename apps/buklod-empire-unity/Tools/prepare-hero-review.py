#!/usr/bin/env python3
"""Refine existing original procedural hero candidates, without modifying MAIN or approving them."""
import copy, importlib.util, json, pathlib, hashlib
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
        return super().ell(mat,joint,center,size,segments,steps)
def main():
    out=root/"Tools/ReviewOutput/heroes"
    out.mkdir(parents=True,exist_ok=True)
    rows=[]
    for hero_id,profile in original.HEROES.items():
        h=Candidate(hero_id,profile)
        row=h.export(out/(hero_id+".glb"))
        assert h.stone_count==1 and len(row["clips"])==9 and row["bones"]>0
        row["stone"]=stone_by[hero_id]["stone"]
        row["sourceGeneratorSha256"]=hashlib.sha256(source.read_bytes()).hexdigest()
        rows.append(row)
    assert len(rows)==13 and len({r["meshHash"] for r in rows})==13
    (out/"manifest.json").write_text(json.dumps({"status":"RIGGED_PROCEDURAL_REVIEW_ONLY","premiumVerified":False,"heroes":rows},indent=2)+"\n")
    print("Prepared 13 independent rigged hero candidates; not likeness-approved.")
if __name__=="__main__":main()
