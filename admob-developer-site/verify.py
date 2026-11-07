"""Contract test against the real Firebase Hosting emulator, cloud runner only."""
import urllib.request, urllib.error, urllib.robotparser, pathlib, hashlib, json
ROOT = pathlib.Path(__file__).parent
EXPECTED = b"google.com, pub-3448515158880100, DIRECT, f08c47fec0942fa0"
assert (ROOT/"public/app-ads.txt").read_bytes() == EXPECTED
config=json.loads((ROOT/"firebase.json").read_text())
assert set(config)=={"hosting","emulators"}
assert not config["hosting"].get("rewrites")
assert not config["hosting"].get("redirects")
checks=[]
for agent in ["Google-adstxt","Mediapartners-Google","Googlebot","Mozilla/5.0"]:
    with urllib.request.urlopen(urllib.request.Request("http://127.0.0.1:5000/app-ads.txt",headers={"User-Agent":agent})) as r:
        body=r.read()
        assert r.status==200
        assert r.headers.get_content_type()=="text/plain"
        assert body==EXPECTED
        checks.append({"agent":agent,"status":r.status,"content_type":r.headers.get("Content-Type"),"sha256":hashlib.sha256(body).hexdigest(),"bytes":len(body)})
with urllib.request.urlopen("http://127.0.0.1:5000/robots.txt") as r:
    assert r.status==200 and r.headers.get_content_type()=="text/plain"
    robots=r.read().decode()
rp=urllib.robotparser.RobotFileParser()
rp.parse(robots.splitlines())
for agent in ["Google-adstxt","Mediapartners-Google","Googlebot"]:
    assert rp.can_fetch(agent,"http://127.0.0.1:5000/app-ads.txt")
with urllib.request.urlopen("http://127.0.0.1:5000/") as r:
    assert r.status==200
    assert 'href="https://buklod.expo.app"' in r.read().decode()
try:
    urllib.request.urlopen("http://127.0.0.1:5000/nonexistent-proof.txt")
    raise AssertionError("Unexpected SPA fallback")
except urllib.error.HTTPError as e:
    assert e.code==404
manifest={p.relative_to(ROOT).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((ROOT/"public").rglob("*")) if p.is_file()}
manifest["firebase.json"]=hashlib.sha256((ROOT/"firebase.json").read_bytes()).hexdigest()
out=pathlib.Path("admob-evidence")
out.mkdir(exist_ok=True)
(out/"rc-contract.json").write_text(json.dumps({"state":"EMULATOR_VERIFIED_NOT_PUBLISHED","checks":checks,"robots_allowed":True,"missing_file_status":404,"manifest":manifest},indent=2))
print("PASS: Firebase Hosting emulator returns exact 58-byte publisher record, text/plain, crawlable robots, homepage app link, and real 404.")
