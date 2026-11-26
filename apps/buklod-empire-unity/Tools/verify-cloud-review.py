"""Check UBA's exported artifact, never upload or publish it."""
import hashlib,json,os,pathlib,re,subprocess,sys,zipfile
player=pathlib.Path(sys.argv[1])
sdk=pathlib.Path(sys.argv[2])
apks=[player] if player.is_file() and player.suffix.lower()==".apk" else list(player.rglob("*.apk")) if player.is_dir() else []
if len(apks)!=1: raise RuntimeError("Expected exactly one exported APK")
apk=apks[0]
windows=os.name=="nt"
aapt_name="aapt.exe" if windows else "aapt"
tools=[p for p in (sdk/"build-tools").iterdir() if (p/aapt_name).is_file() and (p/"lib/apksigner.jar").is_file()]
if not tools: raise RuntimeError("Android SDK signature tooling missing")
def version(p): return tuple(int(x) for x in re.findall(r"\d+",p.name))
tool=max(tools,key=version)
java=pathlib.Path(os.environ["JAVA_HOME"])/"bin"/("java.exe" if windows else "java") if os.environ.get("JAVA_HOME") else "java"
def run(*args):return subprocess.check_output([str(x) for x in args],text=True,timeout=180,errors="replace")
badging=run(tool/aapt_name,"dump","badging",apk)
signature=run(java,"-jar",tool/"lib/apksigner.jar","verify","--verbose",apk)
if re.findall(r"^package: name='([^']+)'",badging,re.M)!=["org.mzbministry.buklod.empire.review"]:raise RuntimeError("Wrong package")
if not re.search(r"^application-debuggable\s*$",badging,re.M):raise RuntimeError("Not a debug APK")
if not re.search(r"Verified using v[23] scheme[^\r\n]*:\s*true\s*$",signature,re.M|re.I):raise RuntimeError("APK signature not verified")
with zipfile.ZipFile(apk) as z:
    entries=z.namelist()
    if len(entries)!=len(set(entries)) or z.testzip() is not None:raise RuntimeError("Invalid APK ZIP")
    abis={x.split("/")[1] for x in entries if x.startswith("lib/") and x.endswith(".so")}
    if abis!={"arm64-v8a"} or not all("lib/arm64-v8a/"+n in entries for n in ("libmain.so","libunity.so","libil2cpp.so")):raise RuntimeError("Wrong native libraries")
    if "AndroidManifest.xml" not in entries or not any(x.startswith("assets/bin/Data/") for x in entries):raise RuntimeError("Unity player data missing")
h=hashlib.sha256()
with apk.open("rb") as f:
    for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
receipt={"status":"VERIFIED_ISOLATED_TEST_ARTIFACT","package":"org.mzbministry.buklod.empire.review","bytes":apk.stat().st_size,"sha256":h.hexdigest(),"architecture":"arm64-v8a","signatureVerified":True,"deviceVerified":False,"productionApproved":False}
print(json.dumps(receipt,indent=2))
apk.with_suffix(".apk.verified.json").write_text(json.dumps(receipt,indent=2)+"\n",encoding="utf-8")
