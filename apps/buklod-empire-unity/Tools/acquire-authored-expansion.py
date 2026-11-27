#!/usr/bin/env python3
"""Fetch exact free CC0 candidate files locally. Never publish or modify production."""
import argparse, hashlib, json, pathlib, shutil, tempfile, urllib.request, urllib.parse, time, os, re
ROOT=pathlib.Path(__file__).resolve().parents[1]
LOCK=ROOT/"Tools/AUTHORED_EXPANSION_LOCK.json"
CACHE=ROOT/"Tools/ReviewOutput/authored-expansion"
DEST=ROOT/"Assets/Generated/ReviewOnly/AuthoredExpansion"
def blob(data):
    return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def valid(data,row):
    return len(data)==row["bytes"] and blob(data)==row["sha"]
def safe_path(path):
    p=pathlib.PurePosixPath(path)
    if p.is_absolute() or not p.parts or any(x in ("..",".") or ":" in x or "\\" in x for x in p.parts):raise ValueError("Unsafe path")
    return p
def fetch(pack,row):
    rel=safe_path(row["path"])
    path=CACHE/pack["id"]/rel
    if path.is_file() and valid(path.read_bytes(),row):return path
    path.parent.mkdir(parents=True,exist_ok=True)
    url="https://raw.githubusercontent.com/"+pack["source"]+"/"+pack["commit"]+"/"+urllib.parse.quote(pack["prefix"]+row["path"],safe="/")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"BUKLOD-Empire-local-review"}),timeout=45) as response:
                if urllib.parse.urlparse(response.geturl()).hostname!="raw.githubusercontent.com":raise ValueError("Unexpected download host")
                data=response.read(row["bytes"]+1)
            if not valid(data,row):raise ValueError("Pinned blob mismatch: "+row["path"])
            with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as f:
                temp=pathlib.Path(f.name);f.write(data)
            try:os.replace(temp,path)
            finally:temp.unlink(missing_ok=True)
            print("Verified",pack["id"],row["path"],flush=True)
            return path
        except (OSError,ValueError) as e:
            if attempt==2:raise
            print("Retry",attempt+1,pack["id"],row["path"],str(e),flush=True);time.sleep(2**attempt)
def validate_lock(doc):
    assert doc["schema"]==1 and doc["status"]=="AUTHORED_REVIEW_CANDIDATES_ONLY"
    assert {p["id"] for p in doc["packs"]}=={"village","props","heroes","animation","vfx","locomotion"}
    for p in doc["packs"]:
        assert re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+",p["source"])
        assert re.fullmatch(r"[0-9a-f]{40}",p["commit"])
        names=set()
        for r in p["rows"]:
            safe_path(r["path"]);assert r["path"] not in names;names.add(r["path"])
            assert re.fullmatch(r"[0-9a-f]{40}",r["sha"]) and 0<r["bytes"]<=32*1024*1024
        assert set(p["models"]+[p["license"]])<=names
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument("--plan",action="store_true");args=parser.parse_args()
    doc=json.loads(LOCK.read_text(encoding="utf8"));validate_lock(doc)
    print("Pinned files:",sum(len(p["rows"]) for p in doc["packs"]),"bytes:",sum(r["bytes"] for p in doc["packs"] for r in p["rows"]),flush=True)
    if args.plan:return
    # Remove old successful marker before any work. Preserve previous verified file cache.
    DEST.mkdir(parents=True,exist_ok=True)
    marker=DEST/"expansion-ready.json";marker.unlink(missing_ok=True)
    for pack in doc["packs"]:
        for row in pack["rows"]:fetch(pack,row)
        # Only authored environment props are admitted to the playable review scene.
        # Hero/animation library stays outside Assets until rig/identity retargeting review.
        if pack["id"] in ("village","props","vfx"):
            for row in pack["rows"]:
                source=CACHE/pack["id"]/safe_path(row["path"]);target=DEST/pack["id"]/safe_path(row["path"])
                target.parent.mkdir(parents=True,exist_ok=True)
                if not target.is_file() or not valid(target.read_bytes(),row):shutil.copyfile(source,target)
                if not valid(target.read_bytes(),row):raise ValueError("Copied asset mismatch")
    marker.write_text(json.dumps({"status":"AUTHORED_ENVIRONMENT_READY","lockSha256":hashlib.sha256(LOCK.read_bytes()).hexdigest(),"productionApproved":False,"heroRetargeted":False})+"\n",encoding="utf8")
    print("Authored environment ready; character/animation candidates acquired but not retargeted.",flush=True)
if __name__=="__main__":main()
