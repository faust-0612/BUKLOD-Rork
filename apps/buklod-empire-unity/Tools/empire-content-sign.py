#!/usr/bin/env python3
"""Local-only signed Empire content publisher. Python 3.10+ and OpenSSL.
Private key stays outside Git. No deployment/network operation is performed.
"""
import argparse, base64, hashlib, json, pathlib, re, shutil, subprocess, tempfile, urllib.parse
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
TRUST = PROJECT / "Assets/Resources/EmpireContentTrust.json"
ABI = "empire-audio-v1"
MAX_BUNDLE = 16 * 1024 * 1024
MAX_REVISION = 32 * 1024 * 1024

def run(*args):
    return subprocess.check_output(args, stderr=subprocess.PIPE)

def digest(data): return hashlib.sha256(data).hexdigest()
def b64(data): return base64.b64encode(data).decode("ascii")

def key_path(raw):
    key = Path(raw).resolve(strict=True)
    repo = Path(run("git", "-C", str(PROJECT), "rev-parse", "--show-toplevel").decode().strip()).resolve()
    if key.is_relative_to(repo): raise ValueError("Private signing key must remain outside Git checkout")
    if not key.is_file(): raise ValueError("Expected existing private signing key")
    return key

def public_params(key, public):
    run("openssl", "pkey", "-in", str(key), "-pubout", "-out", str(public))
    modulus = run("openssl", "rsa", "-pubin", "-in", str(public), "-modulus", "-noout").decode().strip()
    if not modulus.startswith("Modulus="): raise ValueError("Not an RSA key")
    data = bytes.fromhex(modulus.split("=", 1)[1])
    description = run("openssl", "pkey", "-pubin", "-in", str(public), "-text", "-noout").decode()
    if not 256 <= len(data) <= 512 or not re.search(r"Exponent:\s+65537\b", description, re.I):
        raise ValueError("Require RSA 2048–4096, exponent 65537")
    return {"modulus": b64(data), "exponent": "AQAB"}

def make_trust(args):
    uri = urllib.parse.urlsplit(args.base_url)
    if uri.scheme != "https" or not uri.hostname or uri.username or uri.password or uri.query or uri.fragment or not uri.path.endswith("/"):
        raise ValueError("Use a fixed HTTPS content directory URL ending in /")
    if args.apk_code <= 0: raise ValueError("Invalid Android version code")
    key = key_path(args.key)
    with tempfile.TemporaryDirectory() as temp:
        fields = public_params(key, Path(temp) / "public.pem")
    doc = dict(fields, baseUrl=args.base_url, apkVersionCode=args.apk_code)
    TRUST.parent.mkdir(parents=True, exist_ok=True)
    data = (json.dumps(doc, indent=2) + "\n").encode()
    if TRUST.exists():
        if json.loads(TRUST.read_text(encoding="utf-8")) != doc: raise ValueError("Existing trust differs; native key/origin rotation needs deliberate review")
    else:
        with TRUST.open("xb") as out: out.write(data)
    print("Pinned public trust:", TRUST)

def sign(args):
    key = key_path(args.key)
    trust = json.loads(TRUST.read_text(encoding="utf-8"))
    source = Path(args.unsigned_dir).resolve(strict=True)
    output = Path(args.output).resolve()
    if output.exists(): raise FileExistsError(output)
    doc = json.loads((source / "unsigned-content.json").read_text(encoding="utf-8"))
    if args.revision <= 0 or doc.get("revision") != 0 or doc.get("schema") != 1 or doc.get("abi") != ABI or doc.get("platform") != "Android" or doc.get("unity") != "6000.3.29f1":
        raise ValueError("Unexpected content protocol")
    if doc.get("minApk") != trust["apkVersionCode"] or doc.get("maxApk") != trust["apkVersionCode"]:
        raise ValueError("APK version mismatch")
    rows = doc["bundles"]
    if not 1 <= len(rows) <= 8: raise ValueError("Invalid bundle count")
    seen=set(); slots=set(); total=0
    for row in rows:
        h=row["sha256"]; n=row["bytes"]
        if not re.fullmatch(r"[0-9a-f]{64}",h) or h in seen or type(n) is not int or not 0<n<=MAX_BUNDLE:
            raise ValueError("Invalid bundle identity")
        seen.add(h); total+=n
        for slot in row["slots"]:
            if not re.fullmatch(r"[a-z0-9-]{1,64}",slot) or slot in slots: raise ValueError("Invalid slot")
            slots.add(slot)
        path=source/(h+".bundle")
        if path.is_symlink() or path.stat().st_size!=n or digest(path.read_bytes())!=h: raise ValueError("Bundle changed")
    if total>MAX_REVISION or len(slots)!=49: raise ValueError("Invalid initial audio roster or budget")
    doc["revision"]=args.revision
    payload=json.dumps(doc,separators=(",",":"),sort_keys=True).encode()
    with tempfile.TemporaryDirectory() as temp:
        temp=Path(temp); public=temp/"public.pem"; fields=public_params(key,public)
        if any(trust.get(k)!=v for k,v in fields.items()): raise ValueError("Signing key does not match pinned trust")
        data=temp/"payload"; data.write_bytes(payload)
        sig=run("openssl","dgst","-sha256","-sign",str(key),str(data))
        signature=temp/"signature"; signature.write_bytes(sig)
        run("openssl","dgst","-sha256","-verify",str(public),"-signature",str(signature),str(data))
    envelope=json.dumps({"payload":b64(payload),"signature":b64(sig)},separators=(",",":")).encode()
    if len(envelope)>65536: raise ValueError("Manifest too large")
    output.parent.mkdir(parents=True,exist_ok=True)
    temp=Path(tempfile.mkdtemp(prefix=".empire-content-",dir=output.parent))
    try:
        (temp/"bundles").mkdir()
        for h in sorted(seen):
            dst=temp/"bundles"/(h+".bundle");shutil.copyfile(source/(h+".bundle"),dst)
            if digest(dst.read_bytes())!=h:raise ValueError("Output copy failed")
        (temp/"manifest.json").write_bytes(envelope)
        if output.exists():raise FileExistsError(output)
        temp.rename(output)
    finally:
        if temp.exists():shutil.rmtree(temp)
    print("Signed local publish directory:",output,"revision",args.revision,"bytes",total)
    print("Upload immutable bundles first; switch manifest last. Nothing uploaded.")

def main():
    p=argparse.ArgumentParser(description=__doc__);sub=p.add_subparsers(dest="action",required=True)
    t=sub.add_parser("trust");t.add_argument("--key",required=True);t.add_argument("--base-url",required=True);t.add_argument("--apk-code",type=int,required=True);t.set_defaults(fn=make_trust)
    s=sub.add_parser("sign");s.add_argument("--key",required=True);s.add_argument("--unsigned-dir",required=True);s.add_argument("--output",required=True);s.add_argument("--revision",type=int,required=True);s.set_defaults(fn=sign)
    args=p.parse_args();args.fn(args)

if __name__=="__main__":main()
