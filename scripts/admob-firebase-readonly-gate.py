"""Read-only Firebase project, billing-plan, and Hosting gate.

Performs HTTP GET requests only. Does not deploy, create channels, or print
access tokens. Intended for the manual workflow after a later keyless reader
exists. That reader should have roles/firebasehosting.viewer only.
projects.getBillingInfo needs resourcemanager.projects.get, which that role
includes. A custom billing role is not requested from a 403 until Hosting
Viewer is confirmed and this call still fails.
"""
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

PROJECT_ID = os.environ.get("FIREBASE_PROJECT_ID", "buklod-connect")
OUT = pathlib.Path("admob-evidence")
KNOWN_SITE_IDS = ("buklod-connect", "buklod-connect-f8a20", "studio-fddc0")
SENSITIVE_KEYS = {
    "email",
    "token",
    "access_token",
    "accesstoken",
    "refresh_token",
    "private_key",
    "privatekey",
    "client_secret",
    "authorization",
    "idtoken",
    "id_token",
}


def redact(value):
    if isinstance(value, dict):
        cleaned = {}
        for key, item in value.items():
            if str(key).lower() in SENSITIVE_KEYS:
                continue
            cleaned[key] = redact(item)
        return cleaned
    if isinstance(value, list):
        return [redact(item) for item in value]
    return value


def get(url, token):
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/json",
            "User-Agent": "BUKLOD-Firebase-ReadOnly-Gate",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read(1_000_000)
            parsed = json.loads(body.decode("utf-8")) if body else {}
            return response.status, redact(parsed)
    except urllib.error.HTTPError as error:
        raw = error.read(4000).decode("utf-8", "replace")
        message = ""
        try:
            message = json.loads(raw).get("error", {}).get("message", "")
        except ValueError:
            message = raw[:180]
        return error.code, {"message": message[:180]}


def allow_project(payload):
    if not isinstance(payload, dict):
        return payload
    return {
        "projectId": payload.get("projectId"),
        "projectNumber": payload.get("projectNumber"),
        "displayName": payload.get("displayName"),
        "state": payload.get("state"),
    }


def allow_billing(payload):
    if not isinstance(payload, dict) or "message" in payload:
        return payload
    return {
        "billingEnabled": payload.get("billingEnabled"),
        "billingAccountLinked": bool(payload.get("billingAccountName")),
    }


def site_id(site):
    name = site.get("name", "")
    return name.rsplit("/", 1)[-1]


def allow_site(site):
    return {
        "siteId": site_id(site),
        "name": site.get("name"),
        "defaultUrl": site.get("defaultUrl"),
        "type": site.get("type"),
    }


def allow_release(release):
    version = release.get("version") if isinstance(release.get("version"), dict) else {}
    return {
        "name": release.get("name"),
        "type": release.get("type"),
        "releaseTime": release.get("releaseTime"),
        "versionStatus": version.get("status"),
        "versionCreateTime": version.get("createTime"),
    }


def allow_channel(channel):
    return {
        "name": channel.get("name"),
        "url": channel.get("url"),
        "expireTime": channel.get("expireTime"),
    }


def self_check():
    sample = {
        "releaseUser": {"email": "person@example.com"},
        "token": "secret",
        "nested": [{"private_key": "key", "status": "FINALIZED"}],
    }
    encoded = json.dumps(redact(sample))
    assert "person@example.com" not in encoded
    assert "secret" not in encoded
    assert "FINALIZED" in encoded
    assert allow_billing({"billingEnabled": False, "billingAccountName": ""}) == {
        "billingEnabled": False,
        "billingAccountLinked": False,
    }
    assert allow_project({"projectId": "buklod-connect", "resources": {"apiKey": "hidden"}}) == {
        "projectId": "buklod-connect",
        "projectNumber": None,
        "displayName": None,
        "state": None,
    }
    print("self-check ok")


def main():
    if os.environ.get("ADMOB_SELF_CHECK") == "1":
        self_check()
        return 0
    token = os.environ.get("GOOGLE_ACCESS_TOKEN", "")
    if not token:
        print("missing Google access token", file=sys.stderr)
        return 2
    report = {"projectId": PROJECT_ID, "calls": []}

    def record(name, url):
        status, payload = get(url, token)
        report["calls"].append({"name": name, "url": url, "status": status})
        return status, payload

    project_status, project = record(
        "firebase.projects.get",
        f"https://firebase.googleapis.com/v1beta1/projects/{PROJECT_ID}",
    )
    report["project"] = allow_project(project) if project_status == 200 else project

    billing_status, billing = record(
        "cloudbilling.projects.getBillingInfo",
        f"https://cloudbilling.googleapis.com/v1/projects/{PROJECT_ID}/billingInfo",
    )
    report["billing"] = {
        "status": billing_status,
        "body": allow_billing(billing) if billing_status == 200 else billing,
    }
    if billing_status == 403:
        report["billingPermissionGap"] = (
            "403 from projects.getBillingInfo. Confirm roles/firebasehosting.viewer "
            "is the only project role before adding any billing permission. "
            "Do not create buklodBillingPlanReader first."
        )

    sites_status, sites_payload = record(
        "firebasehosting.sites.list",
        f"https://firebasehosting.googleapis.com/v1beta1/projects/{PROJECT_ID}/sites",
    )
    sites = sites_payload.get("sites", []) if sites_status == 200 and isinstance(sites_payload, dict) else []
    trimmed = sites[:20]
    report["sites"] = [allow_site(site) for site in trimmed]
    report["siteCount"] = len(sites)
    report["sitesTruncated"] = len(sites) > len(trimmed)
    found = {item["siteId"] for item in report["sites"]}
    report["knownSiteIdsPresent"] = {site_id: site_id in found for site_id in KNOWN_SITE_IDS}

    report["hosting"] = []
    for site in trimmed:
        current_id = site_id(site)
        parent = f"https://firebasehosting.googleapis.com/v1beta1/sites/{current_id}"
        release_status, releases = record(
            f"releases:{current_id}",
            parent + "/releases?pageSize=5",
        )
        channel_status, channels = record(
            f"channels:{current_id}",
            parent + "/channels?pageSize=10",
        )
        release_items = releases.get("releases", []) if release_status == 200 and isinstance(releases, dict) else []
        channel_items = channels.get("channels", []) if channel_status == 200 and isinstance(channels, dict) else []
        report["hosting"].append(
            {
                "siteId": current_id,
                "releasesStatus": release_status,
                "releases": [allow_release(item) for item in release_items],
                "channelsStatus": channel_status,
                "channels": [allow_channel(item) for item in channel_items],
            }
        )

    billing_body = report["billing"]["body"] if isinstance(report["billing"]["body"], dict) else {}
    spark = billing_status == 200 and billing_body.get("billingEnabled") is False and billing_body.get("billingAccountLinked") is False
    report["sparkNoBilling"] = spark
    report["readGate"] = project_status == 200 and sites_status == 200

    OUT.mkdir(exist_ok=True)
    destination = OUT / "firebase-readonly-gate.json"
    destination.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "wrote": str(destination),
                "projectStatus": project_status,
                "billingStatus": billing_status,
                "sitesStatus": sites_status,
                "siteCount": report["siteCount"],
                "knownSiteIdsPresent": report["knownSiteIdsPresent"],
                "sparkNoBilling": spark,
            }
        )
    )
    if project_status != 200 or sites_status != 200:
        return 10
    if not spark:
        return 11
    return 0


if __name__ == "__main__":
    sys.exit(main())
