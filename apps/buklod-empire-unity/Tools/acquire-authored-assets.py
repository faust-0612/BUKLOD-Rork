#!/usr/bin/env python3
"""Fetch pinned CC0 review assets into ignored cache, never runtime or production."""
import argparse, hashlib, json, os, pathlib, re, time, urllib.request, urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
LOCK=json.loads((ROOT/"Tools/THIRD_PARTY_ASSET_LOCK.json").read_text())
CACHE=ROOT/"Tools/ReviewOutput/ThirdPartyQuaternius"
def blob(data): return hashlib.sha1(b"blob "+str(len(data)).encode()+b"\0"+data).hexdigest()
def safe_rel(path):
    p=pathlib.PurePosixPath(path)
    if p.is_absolute() or not p.parts or any(x in ("..",".") for x in p.parts) or "\\" in path: raise ValueError("Unsafe path")
    return p
def fetch(url, limit):
    for attempt in range(3):
        try:
            req=urllib.request.Request(url,headers={"User-Agent":"BuklodEmpireAssetIntake/1"})
            with urllib.request.urlopen(req,timeout=45) as r:
                if urllib.parse.urlsplit(r.geturl()).hostname not in ("api.github.com","raw.githubusercontent.com"): raise ValueError("Unexpected redirect")
                data=r.read(limit+1)
                if len(data)>limit: raise ValueError("Download exceeds declared limit")
                return data
        except (OSError, urllib.error.URLError):
            if attempt==2: raise
            time.sleep(2**attempt)
def main():
    p=argparse.ArgumentParser();p.add_argument("--pack",action="append",choices=[x["id"] for x in LOCK["packs"]]);p.add_argument("--verify-seed",action="store_true");a=p.parse_args()
    for row in LOCK["seedFiles"]:
        path=ROOT/safe_rel(row["path"])
        if blob(path.read_bytes())!=row["sha"]:raise ValueError("Seed mismatch: "+row["path"])
    print("Committed seed files verified:",len(LOCK["seedFiles"]))
    if a.verify_seed:return
    packs=[x for x in LOCK["packs"] if not a.pack or x["id"] in a.pack]
    for pack in packs:
        root=CACHE/pack["id"];root.mkdir(parents=True,exist_ok=True)
        receipt=root/"intake.json"
        if receipt.exists():receipt.unlink()
        tree=json.loads(fetch("https://api.github.com/repos/"+LOCK["source"]+"/git/trees/"+pack["tree"]+"?recursive=1",8*1024*1024))
        if tree.get("sha")!=pack["tree"] or tree.get("truncated"):raise ValueError("Incomplete pinned tree")
        rows=[x for x in tree["tree"] if x["type"]=="blob" and (pathlib.PurePosixPath(x["path"]).suffix.lower() in (".gltf",".glb",".bin",".png",".jpg",".jpeg",".fbx",".txt") and not re.search(r"(^|/)Preview",x["path"],re.I))]
        if not rows or sum(x["size"] for x in rows)>350*1024*1024:raise ValueError("Unexpected pack size")
        if pack["license"] and not any(x["path"]==pack["license"] for x in rows):raise ValueError("License missing")
        for x in rows:
            if not re.fullmatch(r"[0-9a-f]{40}",x["sha"]) or x["size"]>64*1024*1024:raise ValueError("Unexpected blob")
            path=root/safe_rel(x["path"]);path.parent.mkdir(parents=True,exist_ok=True)
            if path.exists() and blob(path.read_bytes())==x["sha"]:continue
            url="https://raw.githubusercontent.com/"+LOCK["source"]+"/"+LOCK["commit"]+"/"+urllib.parse.quote(pack["directory"]+"/"+x["path"],safe="/")
            data=fetch(url,x["size"])
            if len(data)!=x["size"] or blob(data)!=x["sha"]:raise ValueError("Upstream hash mismatch: "+x["path"])
            tmp=path.with_suffix(path.suffix+".tmp");tmp.write_bytes(data);os.replace(tmp,path)
        if pack["license"] and "CC0" not in (root/pack["license"]).read_text(encoding="utf-8",errors="replace"):raise ValueError("Unexpected license")
        receipt.write_text(json.dumps({"pack":pack["id"],"commit":LOCK["commit"],"tree":pack["tree"],"files":len(rows),"bytes":sum(x["size"] for x in rows),"status":"HASH_CHECKED_REVIEW_ONLY","unityImported":False,"productionApproved":False},indent=2)+"\n")
        print("Acquired",pack["id"],len(rows),"files")
if __name__=="__main__":main()
