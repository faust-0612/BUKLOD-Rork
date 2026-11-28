# Quiz Dedicated retirement evidence — 2026-11-28
## Targets
Keep BUKLOD Connect yhanxndaqbmuzbdqlblu. Retire only BUKLOD Quiz Dedicated cjtehbfspgimyhifnjon.
## Verified evidence
- Owner terminal confirmed R28 production marker and JavaScript bundle SHA-256; source 9b6081baf357eaeee945633e71bb41af5104887e, deployment jf5rqsyiw4.
- R29 database recovery live; entry-v1 v17 deployed with JWT gateway verification retained, Connect-only source independently fetched and matched. Rollback source commit 466693dc8914bad0a1fcb3e3582b564080dda9bd.
- Owner terminal reported SOURCE_LOGICAL_BACKUP_PASS and LOCAL_POSTGRES_LOGICAL_RESTORE_PASS rows=126788, STORAGE_SHA256_MATCH=98/98, QUIZ_DEDICATED_ENCRYPTED_LOGICAL_BACKUP_PASS, NO_CLOUD_MUTATION_OR_DELETION. Independent encrypted backup remains on owner's local machine; not uploaded.
- Owner-reported encrypted archive SHA-256 dd34c25af4ac0de4ccaad1ff536ed40f92fd1e596612198fb1856041390d2329. Logical restore only; not a full hosted Supabase runtime restoration.
- Connect restricted archive: 110 delta records; checksums valid.
- 2026-11-28 06:46–09:44 UTC Dedicated logs: no exam RPC or edge-function traffic; 98 successful storage GETs consistent with backup, plus auth GET and other requests. Dedicated active unexpired STARTED attempts zero; latest attempt updated Nov 5. Connect class records, sections, integrity analysis, availability successful HTTP 200; one capabilities HTTP 401 also observed.
## Blocker and next gate
Supabase pause request for Dedicated rejected: ProjectPausingNotEntitledException (paid plan). Both projects independently rechecked ACTIVE_HEALTHY. Do not downgrade organization; do not pause Connect. No permanent deletion action available in connector.
Alternative: owner performs authenticated browser smoke test with Dedicated hostname blocked locally (no changes to either cloud project). Verify SSO, class records and exam access; do not mutate real grades or submissions for test. Browser block is not server-wide isolation. Migration-only legacy storage transfer endpoint still exists on Connect; not ordinary exam runtime. Final irreversible deletion via Dedicated dashboard only after test and owner confirms backup retained; verify Connect stays healthy and production after deletion.
No deletion performed. No new build/OTA. No credentials or private student rows included in this receipt.
