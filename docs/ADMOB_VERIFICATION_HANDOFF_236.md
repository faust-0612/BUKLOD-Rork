# PR #236 — BUKLOD AdMob two-track handoff
Prepared October 21, 2026 (Asia/Manila). Owner selected **handoff only**, without Firebase connection or publication.

## Result
Track A investigation completed within accessible cloud records; exact-live reproducibility remains unproven. Track B has a **cloud-emulator-verified static candidate**, ready for Firebase account/plan/site verification. Neither route has been published. AdMob is not Verified.

[Passing cloud run](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39609836803) at commit `d6abe55ebfa30aff555899c00911771f71189ff8`.
- [Static candidate + per-file SHA-256 contract](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39609836803/artifacts/12349138352), ZIP SHA-256 `c242d221e98d601a217a0eb6ccf97be8a0a300652d58c7463793d88e0e14088b`.
- [Cloud provenance evidence](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39609836803/artifacts/12349548431), ZIP SHA-256 `3dad7018a102373e8456f31da6a275298558ed09f03f8da2d028274484e0aa30`.
- Artifacts retained for 30 days (through November 20, 2026, subject to repository deletion/settings). Source remains in this PR.
- Emulator test success establishes candidate routing/header/body/robots behavior, not live TLS/CDN behavior or AdMob confirmation.

## Track A — new provenance investigation
Production remains `zpvvpw9hif`, project `23dad7d0-389a-406e-8dec-08965dab85d8`, created `2026-10-03T20:34:07.655Z` (October 4, 4:34 AM Manila).
Accepted initial proof: live /app-ads.txt is 200 text/html, byte-identical to homepage; live and immutable deployment HTML/JS hashes match.

New cloud investigation:
- Listed **29 GitHub runs across October 2–4**, including all seven October 3 records. October 3 records are two QA runs and five failed workflow records, with no artifacts. Six accessible relevant QA/web logs were searched for the deployment ID and exact live bundle filename, without a match; failed workflow records had no readable job log.
- Inventoried **38 currently listed GitHub artifacts**, including new audit/RC outputs. The newest pre-existing historical artifact is September 9. Retained older entries have explicit expiry/expired metadata in provenance.json; no October 3 export archive was listed. An empty inventory does not establish whether an artifact was never uploaded or was deleted.
- GitHub Releases list is empty. Only current tag is the unrelated October 21 Android verification tag; it was observed, not modified or run.
- Fetched all available branch/tag history on an Ubuntu GitHub runner: **406 refs, 22,716 Git objects**. Object-path search found neither the exact live bundle filename nor __main.js, __node_compat.js, or deploy.tar archive. Four historical production manifest blobs were examined: August/September release configuration, without a zpvvpw9hif source/artifact hash manifest.
- Current tracked dist-web JavaScript filenames differ from the live index-6a93809e5c09eb7c7bd6b0635c410db2.js. It is not a demonstrated replacement.
- Queried three existing EAS workflow filenames from the repository (deploy-web.yml, deploy-community-feed-modes-once.yml, deploy-home-spatial-once.yml); EAS returned WORKFLOW_NOT_FOUND for each. This does not prove no other EAS workflow ever existed.
- Read current EAS production metadata for **33 environment variable names** and computed SHA-256 fingerprints for **28 PUBLIC EXPO_PUBLIC_ string values inside the cloud runner**. Sensitive/secret values were not requested. These are current metadata/fingerprints, not an authenticated historical October 3 snapshot. GitHub secret-name enumeration returned HTTP 403; credential absence was not inferred.
- Searched connected Drive for deployment ID, BUKLOD backup/export archives, manifests, deploy.tar, and worker module names; inspected BUKLOD APP and legacy BUKLODConnect folders. No matching 2026 Expo release artifact was found. Native APK entries were not downloaded or used.
- The previous incomplete Expo recovery endpoint was not re-run in this follow-up. No source build or replacement worker was invented.

Official Expo documentation describes immutable Hosting deployments, alias promotion, and exporting source before upload. The reviewed documentation/current CLI command surface does not establish an official complete deployed-worker export/recovery guarantee. Do not claim full recovery is globally impossible: Expo support may have provider-side capabilities unavailable here.
Sources: [Deployments and aliases](https://docs.expo.dev/eas/hosting/deployments-and-aliases/), [Publishing websites](https://docs.expo.dev/guides/publishing-websites/), [Worker runtime](https://docs.expo.dev/eas/hosting/reference/worker-runtime/), [Official support](https://expo.dev/support).

**Track-A blocker:** no authoritative source + historical environment + complete worker artifact/hashes tying zpvvpw9hif to a reproducible export. Full asset/worker content-hash comparison cannot be completed without the missing reference bodies/manifest. Preserving a static asset list alone does not prove worker equivalence.

### Optional Expo support request draft — not sent
Use [Expo contact](https://expo.dev/contact), selecting Hosting/support. Do not purchase a plan or paid support.
> Please advise whether complete recovery/export is available for project 23dad7d0-389a-406e-8dec-08965dab85d8, production deployment zpvvpw9hif / 01a10379-5ca7-711e-a3a8-66868053aae1, created 2026-10-03T20:34:07.655Z. Existing authenticated recovery returns 240 static asset paths and deployment metadata, but __main.js and __node_compat.js entries lack contents. We need original complete module bytes or authenticated content hashes plus source/toolchain/environment provenance to reproduce a production-equivalent candidate. Please do not alter the production alias. Can the original upload/export archive or source/workflow identity be recovered through an existing free capability? If not, please confirm the limitation.

## Track B — separate developer website
Google explicitly allows an alternative developer website / Firebase Hosting when the current site cannot serve a root app-ads.txt. Firebase Spark requires no payment information. This is **Firebase Hosting**, not Firebase App Hosting.
Sources:
- [Google AdMob FAQ](https://support.google.com/admob/answer/9675354)
- [Troubleshooting and alternate developer domain](https://support.google.com/admob/answer/9776740)
- [Official Firebase app-ads.txt guide](https://developers.google.com/admob/android/next-gen/app-ads)
- [Firebase pricing plans](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)
- [Preview and exact-version clone to live](https://firebase.google.com/docs/hosting/test-preview-deploy)

### Existing cloud site findings
Drive's legacy buklod.firebaserc.txt references project `buklod-connect`; another legacy Firebase config references site `buklod-connect-f8a20` and a target references `studio-fddc0`.
Public cloud HTTP checks:
| Host | Homepage | /app-ads.txt |
|---|---|---|
| buklod-connect.web.app | 200 Firebase welcome page | 404 |
| buklod-connect-f8a20.web.app | 200 Firebase welcome page | 404 |
| studio-fddc0.web.app | 200 Firebase welcome page | 200 text/html (invalid) |

These references/public responses do **not** establish current account ownership, available deploy credentials, billing plan, quota, or permission to replace existing site content.

### Cloud authentication route check — October 21, 2026
The tested static candidate is unchanged and still available: [artifact 12349138352](https://github.com/faust-0612/BUKLOD-Rork/actions/runs/39609836803/artifacts/12349138352), not expired, from passing run 39609836803. It was not rebuilt.

Authenticated route check in this Cursor cloud session:
- Tool registry exposes Supabase, Vercel, and Cursor tools. It exposes no Firebase API tools and no authorized Google login. No Firebase MCP namespace is available to call.
- This VM has no `gcloud` login, no Application Default Credentials, and no `FIREBASE`/`GOOGLE` credential environment variables. Unauthenticated calls to the Firebase project, Hosting sites, and Cloud Billing APIs for `buklod-connect` returned HTTP 401. That is not an ownership or Spark result.
- Repository workflows reference only `EXPO_TOKEN`. No workflow contains a Workload Identity provider or a Firebase service-account secret. GitHub repository secret metadata remains HTTP 403 for this integration, including for `EXPO_TOKEN`, so an unused Firebase secret can neither be confirmed nor ruled out. Organization secret lookups for the same Firebase names returned HTTP 404. No GitHub environments exist.
- Official Firebase Hosting GitHub setup (`firebase init hosting:github`, documented October 20, 2026) creates a long-lived JSON key. That path was not used.

The read-only project/Spark/site gate is therefore not runnable yet. A manual GitHub workflow, `.github/workflows/admob_firebase_readonly_gate.yml`, is prepared and does not run on push. It only performs GET requests for the Firebase project, the Cloud Billing enabled flag, Hosting sites, release metadata, and channels. It does not deploy or create a preview channel. Dispatch it only after the owner action below, using the project number from that reply.

### Candidate scope and tests
Files are confined to `admob-developer-site/`, plus cloud audit/CI files. Hosting config serves only four public static files; no rewrites, redirects, Functions, databases, native code, or project binding.
- /app-ads.txt: exactly **58 bytes**, no BOM or trailing newline:
  `google.com, pub-3448515158880100, DIRECT, f08c47fec0942fa0`
- Explicit text/plain; charset=utf-8 response header.
- robots.txt allows crawling.
- Homepage identifies BUKLOD and links to unchanged https://buklod.expo.app.
- Unknown path returns genuine 404, preventing SPA fallback.
Official firebase-tools 14.22.0 Hosting emulator tests passed on GitHub Ubuntu for Google-adstxt, Mediapartners-Google, Googlebot, and browser user agents. The demo-buklod-admob emulator ID cannot deploy to a real project. No Firebase credentials were supplied to that job.

### Single next owner action
Do not reinstall the Firebase plugin. Do not download a JSON key, copy a token into chat, or run npm/npx on the Windows PC. Use the Google account that already owns `buklod-connect`. If that project is absent from the project picker, stop; do not create a project. If any screen asks to upgrade to Blaze or add a billing account, stop.

In one Google Cloud console session, create keyless read access for this repository only:

1. Open [Create role](https://console.cloud.google.com/iam-admin/roles/create?project=buklod-connect). Title `BUKLOD billing plan reader`, ID `buklodBillingPlanReader`, permission `billing.resourceAssociations.get` only, then **Create**. Do not assign Project Billing Manager.
2. Open [New workload provider and pool](https://console.cloud.google.com/iam-admin/workload-identity-pools/create?project=buklod-connect). If prompted, **Enable** the IAM, Service Account Credentials, and Security Token Service APIs.
   - Pool name: `buklod-github-actions`
   - Continue
   - Provider: **OpenID Connect (OIDC)**; provider name and provider ID: `github`
   - Issuer URL: `https://token.actions.githubusercontent.com/`
   - Audiences: **Default audience**
   - Continue
   - Attribute mapping: keep `google.subject` = `assertion.sub`, and add `attribute.repository_id` = `assertion.repository_id`
   - Attribute condition: `assertion.repository_id=='1337331837'`
   - **Save**
3. Open [Create service account](https://console.cloud.google.com/iam-admin/serviceaccounts/create?project=buklod-connect). Name and ID: `buklod-hosting-reader`. Grant only **Firebase Develop Viewer** (`roles/firebase.developViewer`) and the custom role **BUKLOD billing plan reader**. Leave the next user-access step empty. **Done**. Do not open **Keys** and do not create a key.
4. Open [Workload Identity Pools](https://console.cloud.google.com/iam-admin/workload-identity-pools?project=buklod-connect), select `buklod-github-actions`, then **Grant access**. Choose service-account impersonation, select `buklod-hosting-reader@buklod-connect.iam.gserviceaccount.com`, then **Only identities matching the filter**. Attribute name `repository_id`, attribute value `1337331837`. **Save**.

Reply on this PR with the numeric **Project number** shown at [Project settings](https://console.firebase.google.com/project/buklod-connect/settings/general). That number is not a credential. The cloud gate will then be dispatched manually against the prepared workflow. No publication, Play listing change, or new Firebase project is included in this action.

### Subsequent cloud release gates
1. Confirm target project/site and free access; pin the candidate source commit/artifact. Keep Expo unchanged.
2. Use GitHub cloud execution and approved Firebase authentication only; never run npm/npx/firebase CLI or downloads on the owner's laptop. Do not pass credential values through chat.
3. Publish a scoped Firebase preview for this static directory only; verify HTTPS root /app-ads.txt status 200, text/plain and exact bytes, robots allow crawlers, homepage link, and unknown path 404. Save Firebase version/site/channel identifiers.
4. After required account/publication approval, clone the **exact verified preview version** to the selected live Hosting channel; verify live HTTP again. Do not rebuild source between preview and live.
5. Only then request approval for or have owner perform the Play developer website change.

### Exact crawl URL and Play change — conditional, not published
Use the site's actual verified root hostname, with no www/m prefix, extra nested subdomain, private GitHub raw URL, or subpath.
For example **only if ownership and publication of site buklod-connect-f8a20 are approved and verified**:
- Play developer website: `https://buklod-connect-f8a20.web.app`
- AdMob expected crawl URL: `https://buklod-connect-f8a20.web.app/app-ads.txt`
That file URL currently returns 404; it is not a successful live result. If another site is selected, derive both exact URLs from the verified Firebase site ID. Google's guide explicitly supports PROJECT_ID.web.app; generic crawler rules probe at most one subdomain level, exclude www/m, and ignore website subpaths.

Owner Play steps, **after confirmed live file and explicit listing approval**:
[Play Console](https://play.google.com/console) → BUKLOD (org.mzbministry.buklod) → Grow users → Store presence → Store settings → Store listing contact details → Website = verified developer root URL → save/submit the listing change as prompted. Confirm that the public app's App support website points to that same hostname.
No listing change has been performed.

Then [AdMob](https://admob.google.com/) → Apps → View all apps → app-ads.txt → BUKLOD Android → expand row → Check for updates → verify status. Inspect AdMob's actual crawled URL. Google documents 24 hours or more after developer-domain changes; its FAQ advises allowing longer and waiting a week before seeking further help. Do not mark Verified until AdMob confirms.

## Choice
Track B is the narrower path for finishing AdMob because it avoids replacing the live Expo application and needs only a small static website plus a separately approved Play listing domain change. Track A remains an optional recovery effort requiring missing provenance/provider help.

No publication, Expo alias change, new project, billing activation, Play metadata change, APK/AAB/OTA, Supabase/database mutation, or owner-laptop file write was performed. The October 21 authentication follow-up added only the idle read-only workflow, its GET-only script, and this handoff. The read-only gate was not dispatched because Google credentials are not available yet. Documentation/metadata reads on C: were read-only; all intentional writes and package operations were GitHub/cloud only.
