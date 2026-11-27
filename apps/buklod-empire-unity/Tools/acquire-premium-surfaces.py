#!/usr/bin/env python3
"""Powered by Poly Haven. Local build-time CC0 surface acquisition, never runtime networking."""
import hashlib, io, json, os, pathlib, re, tempfile, time, urllib.request, urllib.parse
from PIL import Image, ImageOps
ROOT=pathlib.Path(__file__).resolve().parents[1]
CACHE=ROOT/"Tools/ReviewOutput/polyhaven-surfaces-v1"
RES=4096
ASSETS={"soil":"forest_floor","grass":"sparse_grass","stone":"mossy_rock","paving":"cobblestone_01","timber":"medieval_wood"}
LIMIT=64*1024*1024
UA="BUKLOD-Empire-Offline-Asset-Builder/1.0"
def sha(data):return hashlib.sha256(data).hexdigest()
def atomic(path,data):
    path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent,delete=False) as f:
        tmp=pathlib.Path(f.name);f.write(data)
    try:os.replace(tmp,path)
    finally:tmp.unlink(missing_ok=True)
def request(url,limit,host):
    def check(u):
        p=urllib.parse.urlsplit(u)
        if p.scheme!="https" or p.hostname!=host or p.username or p.password or p.port not in (None,443):
            raise ValueError("Unexpected Poly Haven endpoint")
    check(url)
    class Redirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,req,fp,code,msg,headers,newurl):
            check(newurl)
            return super().redirect_request(req,fp,code,msg,headers,newurl)
    opener=urllib.request.build_opener(Redirect())
    for attempt in range(3):
        try:
            with opener.open(urllib.request.Request(url,headers={"User-Agent":UA}),timeout=45) as r:
                check(r.geturl());data=r.read(limit+1)
            if len(data)>limit:raise ValueError("Asset exceeds byte limit")
            return data
        except OSError:
            if attempt==2:raise
            time.sleep(2**attempt)
def select(doc,key):
    formats=doc[key]["4k"]
    row=next((formats[x] for x in ("jpg","png") if x in formats),None)
    if not isinstance(row,dict) or not isinstance(row.get("size"),int) or not 0<row["size"]<=LIMIT or not re.fullmatch("[0-9a-f]{32}",row.get("md5","")):
        raise ValueError("Invalid provider descriptor: "+key)
    return {k:row[k] for k in ("url","size","md5")}
def source(asset,key,row):
    path=CACHE/"originals"/asset/(key+"-"+row["md5"])
    def valid(data):return len(data)==row["size"] and hashlib.md5(data).hexdigest()==row["md5"]
    if path.is_file():
        data=path.read_bytes()
        if valid(data):return data
    data=request(row["url"],row["size"],"dl.polyhaven.org")
    if not valid(data):raise ValueError("Provider checksum mismatch: "+asset+"/"+key)
    atomic(path,data);return data
def pack(diff,rough):
    with Image.open(io.BytesIO(diff)) as a, Image.open(io.BytesIO(rough)) as r:
        if a.size!=(RES,RES) or r.size!=a.size:raise ValueError("Unexpected texture dimensions")
        rgba=a.convert("RGB");rgba.putalpha(ImageOps.invert(r.convert("L")))
        out=io.BytesIO();rgba.save(out,format="PNG");return out.getvalue()
def main():
    print("Powered by Poly Haven — CC0 photographed surfaces; no account or paid API",flush=True)
    CACHE.mkdir(parents=True,exist_ok=True)
    marker=CACHE/"manifest.json"
    marker.unlink(missing_ok=True)
    rows=[]
    for kind,asset in ASSETS.items():
        pin=CACHE/"originals"/asset/"descriptor.json"
        if pin.is_file():desc=json.loads(pin.read_text(encoding="utf8"))
        else:
            raw=request("https://api.polyhaven.com/files/"+asset,2*1024*1024,"api.polyhaven.com")
            doc=json.loads(raw);desc={k:select(doc,k) for k in ("diff","rough")}
            atomic(pin,json.dumps(desc,sort_keys=True).encode())
        # Recheck descriptors even on cached runs.
        for k in ("diff","rough"):
            select({k:{"4k":{"png":desc[k]}}},k)
        d=source(asset,"diff",desc["diff"]);r=source(asset,"rough",desc["rough"])
        data=pack(d,r);file=kind+".png"
        target=CACHE/file
        if not target.is_file() or sha(target.read_bytes())!=sha(data):atomic(target,data)
        rows.append({"kind":kind,"asset":asset,"file":file,"bytes":len(data),"sha256":sha(data),"diffSha256":sha(d),"roughSha256":sha(r)})
        print("Verified",kind,asset,flush=True)
    atomic(marker,json.dumps({"status":"POLYHAVEN_CC0_REVIEW_ONLY","resolution":RES,"provider":"Poly Haven","license":"CC0","productionApproved":False,"textures":rows},indent=2).encode())
if __name__=="__main__":main()
