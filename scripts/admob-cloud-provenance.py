"""Read-only cloud provenance and public-host audit. Never prints credential values."""
import os, json, urllib.request, urllib.error, hashlib, re, pathlib, datetime, subprocess, concurrent.futures
REPO = "faust-0612/BUKLOD-Rork"
APP = "23dad7d0-389a-406e-8dec-08965dab85d8"
OUT = pathlib.Path("admob-evidence")
OUT.mkdir(exist_ok=True)
report = {}
def get(url, token=None):
    headers = {"User-Agent": "Mozilla/5.0 BUKLOD-ReadOnly-Audit", "Accept": "application/json"}
    if token: headers["Authorization"] = "Bearer " + token
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"http_error": e.code}
def gh(path):
    return get("https://api.github.com/repos/" + REPO + "/" + path, os.environ["GH_TOKEN"])
def gql(query, variables=None):
    req = urllib.request.Request("https://api.expo.dev/graphql", data=json.dumps({"query": query, "variables": variables or {}}).encode(), headers={"Content-Type": "application/json", "User-Agent": "eas-cli", "Authorization": "Bearer " + os.environ["EXPO_TOKEN"]})
    try:
        with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)
    except urllib.error.HTTPError as e:
        try:
            parsed=json.load(e)
            return {"http_error":e.code,"errors":[{"message":x.get("message","")} for x in parsed.get("errors",[])]}
        except ValueError:
            return {"http_error":e.code}
runs = gh("actions/runs?created=2026-10-02..2026-10-04&per_page=100")
summaries = []
for run in runs.get("workflow_runs", []):
    rid = run["id"]
    arts = gh(f"actions/runs/{rid}/artifacts?per_page=100")
    summaries.append({"id": rid, "name": run["name"], "sha": run["head_sha"], "created_at": run["created_at"], "conclusion": run["conclusion"], "artifacts": [{"id": a["id"], "name": a["name"], "expired": a["expired"], "expires_at": a["expires_at"]} for a in arts.get("artifacts", [])]})
log_checks=[]
for run in runs.get("workflow_runs", []):
    if "web" in run["name"].lower() or run["created_at"].startswith("2026-10-03"):
        process=subprocess.run(["gh","run","view",str(run["id"]),"--repo",REPO,"--log"],capture_output=True,text=True,timeout=60)
        text=process.stdout
        log_checks.append({"run":run["id"],"available":process.returncode==0,"log_bytes":len(text.encode()),"sha256":hashlib.sha256(text.encode()).hexdigest() if text else None,"deployment_identifier_found":"zpvvpw9hif" in text,"live_bundle_filename_found":"6a93809e5c09eb7c7bd6b0635c410db2" in text,"mentions_export":"expo export" in text})
report["historical_log_checks"]=log_checks
report["github_oct2_4_runs"] = {"total_count": runs.get("total_count"), "runs": summaries}
artifacts = []
for page in range(1, 11):
    data = gh(f"actions/artifacts?per_page=100&page={page}")
    if "http_error" in data:
        report["artifact_inventory_error"] = data
        break
    entries = data.get("artifacts", [])
    for a in entries:
        artifacts.append({"id": a["id"], "name": a["name"], "created_at": a["created_at"], "expired": a["expired"], "expires_at": a["expires_at"], "run": a.get("workflow_run", {}).get("id")})
    if len(entries) < 100: break
report["artifact_inventory"] = {"count": len(artifacts), "items": artifacts, "pages_scanned": page}
releases = gh("releases?per_page=100")
report["releases"] = [{"id": r["id"], "tag": r["tag_name"], "assets": [{"name": a["name"], "size": a["size"]} for a in r["assets"]]} for r in releases] if isinstance(releases,list) else releases
report["tags"] = gh("git/matching-refs/tags")
secrets = gh("actions/secrets?per_page=100")
report["github_credential_names"] = [s["name"] for s in secrets.get("secrets", [])] if "secrets" in secrets else secrets
query = """query($appId:String!,$environment:EnvironmentVariableEnvironment){app{byId(appId:$appId){id environmentVariables(environment:$environment){name visibility type environments createdAt updatedAt}}}}"""
report["expo_identity_and_env_names"] = gql(query, {"appId":APP,"environment":"production"})
meta = report["expo_identity_and_env_names"].get("data",{}).get("app",{}).get("byId",{})
public_names = [v["name"] for v in meta.get("environmentVariables",[]) if v["visibility"] == "PUBLIC" and v["type"] == "STRING" and v["name"].startswith("EXPO_PUBLIC_")]
if public_names:
    q = """query($id:String!,$names:[String!],$environment:EnvironmentVariableEnvironment){app{byId(appId:$id){environmentVariables(environment:$environment,filterNames:$names){name value}}}}"""
    values = gql(q, {"id":APP,"names":public_names,"environment":"production"})
    variables = values.get("data",{}).get("app",{}).get("byId",{}).get("environmentVariables",[])
    report["current_public_env_fingerprints"] = [{"name":v["name"],"sha256":hashlib.sha256(v["value"].encode()).hexdigest() if isinstance(v.get("value"),str) else None} for v in variables]
report["env_caveat"] = "Current variable metadata/fingerprints only; not a historical October 3 environment snapshot. Secret and sensitive values were not requested."
workflow_names = ["deploy-web.yml", "deploy-community-feed-modes-once.yml", "deploy-home-spatial-once.yml"]
for name in workflow_names:
    q = """query($id:ID!,$name:String!){workflows{byAppIdAndFileName(appId:$id,fileName:$name){id runsPaginated(first:100){edges{node{id status gitCommitHash requestedGitRef createdAt}}}}}}"""
    report["eas_workflow_" + name] = gql(q, {"id":APP,"name":name})
# Search existing Git objects; never log file contents or secret-looking matches.
objects = subprocess.check_output(["git","rev-list","--all","--objects"],text=True).splitlines()
needles = ["6a93809e5c09eb7c7bd6b0635c410db2", "__main.js", "__node_compat.js", "deploy.tar", "web-release", "RELEASE_MANIFEST"]
report["git_object_path_hits"] = [line for line in objects if any(n.lower() in line.lower() for n in needles)][:200]
report["git_object_count"] = len(objects)
report["git_ref_count"] = len(subprocess.check_output(["git","for-each-ref","--format=%(refname)"],text=True).splitlines())
commits = subprocess.check_output(["git","log","--all","--since=2026-10-02T00:00:00Z","--until=2026-10-04T23:59:59Z","--format=%H %cI %s"],text=True).splitlines()
report["historical_commits_oct2_4"] = commits[:200]
report["tracked_backup_manifest_paths"] = [x["path"] for x in gh("git/trees/main?recursive=1").get("tree",[]) if re.search(r"manifest|backup|release|firebase|firebaserc|CNAME",x["path"],re.I) and not re.search(r"node_modules|android/|assets/",x["path"])][:150]
sites = ["https://buklod-connect.web.app","https://buklod-connect-f8a20.web.app","https://studio-fddc0.web.app"]
checks=[]
for site in sites:
    for path in ["/","/app-ads.txt","/robots.txt"]:
        url=site+path
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"Mozilla/5.0"}),timeout=30) as r:
                body=r.read(2000000)
                checks.append({"url":url,"final_url":r.url,"status":r.status,"content_type":r.headers.get("Content-Type"),"bytes":len(body),"sha256":hashlib.sha256(body).hexdigest(),"record_match":body==b"google.com, pub-3448515158880100, DIRECT, f08c47fec0942fa0","title":re.findall(r"<title>(.*?)</title>",body.decode(errors="replace"),re.I)[:1]})
        except urllib.error.HTTPError as e: checks.append({"url":url,"status":e.code})
        except Exception as e: checks.append({"url":url,"error_type":type(e).__name__})
report["historical_firebase_public_sites"] = checks
(OUT/"provenance.json").write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
