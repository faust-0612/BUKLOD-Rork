#!/usr/bin/env python3
"""Prepare original review models without network calls, paid tooling or production changes."""
import hashlib, json, pathlib, subprocess, sys, zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
TOOLS=ROOT/"Tools"
CANDIDATES=TOOLS/"AssetCandidates"
OUTPUT=TOOLS/"ReviewOutput"
def git_blob(data):
    return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def verify_glb(data):
    import struct
    if len(data)<28 or struct.unpack_from("<4sII",data)!=(b"glTF",2,len(data)):
        raise ValueError("Invalid GLB")
    size,kind=struct.unpack_from("<I4s",data,12)
    if kind!=b"JSON" or 28+size>len(data): raise ValueError("Invalid JSON chunk")
    doc=json.loads(data[20:20+size])
    length,kind=struct.unpack_from("<I4s",data,20+size)
    if kind!=b"BIN\0" or 28+size+length!=len(data): raise ValueError("Invalid BIN chunk")
    return doc
def main():
    subprocess.run([sys.executable,str(TOOLS/"prepare-hero-review.py")],check=True)
    heroes=json.loads((OUTPUT/"heroes/manifest.json").read_text())["heroes"]
    assert len(heroes)==13 and len({x["id"] for x in heroes})==13
    for row in heroes:
        data=(OUTPUT/"heroes"/row["file"]).read_bytes()
        assert hashlib.sha256(data).hexdigest()==row["sha256"]
        doc=verify_glb(data)
        assert len(doc["animations"])==12 and set(a["name"] for a in doc["animations"])==set(row["clips"])
        from skill_motions import PROFILES, SLOTS
        motions={a["name"]:a.get("extras",{}).get("canonicalSkill") for a in doc["animations"]}
        assert all(motions[slot]==profile[0] for slot,profile in zip(SLOTS,PROFILES[row["id"]]))
    from validate_skill_motions import validate_roster
    verified=validate_roster(OUTPUT/"heroes")
    (OUTPUT/"heroes/skill-motion-verification.json").write_text(json.dumps(verified,indent=2)+"\n")
    subprocess.run([sys.executable,str(TOOLS/"variant_review.py")],check=True)
    subprocess.run([sys.executable,str(TOOLS/"prepare_hero_lod.py")],check=True)
    rig=json.loads((CANDIDATES/"Rigged/manifest.json").read_text())
    dest=OUTPUT/"rigged-factions";dest.mkdir(parents=True,exist_ok=True)
    count=0
    for row in rig["packages"]:
        path=ROOT/row["path"]
        assert git_blob(path.read_bytes())==row["gitBlob"]
        models={x["id"]+".glb":x for x in row["models"]}
        with zipfile.ZipFile(path) as z:
            assert z.testzip() is None and set(z.namelist())==set(models) and len(z.namelist())==len(models)
            for name,model in models.items():
                assert pathlib.PurePath(name).name==name
                data=z.read(name);doc=verify_glb(data)
                assert len(data)==model["bytes"] and len(doc["animations"])==6 and len(doc["skins"][0]["joints"])==model["joints"]
                (dest/name).write_bytes(data);count+=1
    assert count==22
    print("Prepared 13 heroes and 22 faction review GLBs; production remains blocked.")
if __name__=="__main__": main()
