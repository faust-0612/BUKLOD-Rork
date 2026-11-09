# BUKLOD OTA RC handoff — Canonical Home surfaces and Contribution Destination
Date: 2026-11-09
Status: SOURCE-STAGED RC CANDIDATE; NOT PUBLISHED
Branch: release/ota-home-scope-destination-rc-20261109
Merged base: main ca8e7e508b13e197b0c86aaf3d275962d977d157
Input: fix/canonical-home-surfaces-reconciled-20261109 ccd1195c5609ad72fe1681bffa162fbd45bf4add

## Scope
- BUKLOD Hub is the canonical public Home; old Public Home remains a redirect-only compatibility path.
- Organization and Cluster Scope Homes show a member-authorized scope fund summary only; no personal earnings wallet or gross AdMob accounting.
- BUKLOD Bahay remains family-only and is not linked to organization/community wallets.
- User-facing QMP/earnings details show only authenticated personal estimates, finalized earnings, withdrawal status; internal gross and pool formulas remain admin/backend only.
- Personal Bayanihan/Economy shows an authenticated Contribution Destination chooser and optional on-demand personal lifetime earnings sources.
- Picker lists active joined root Organizations or Clusters, requires explicit confirmation, never writes direct ledger rows. Existing production selection RPC validates qualification, membership and a 30-day switch lock.
- Public Hub links to personal earnings/destination; Community Contribution detail links to same chooser.

## Runtime and boundaries
- App from current main configuration: org.mzbministry.buklod; Android code 30; Expo runtimeVersion 1.3.2; production OTA channel.
- No native package, EAS config or runtime version changes; no schema migration, cash ledger, payout RPC or entitlement changes.
- Production backend already has public.set_my_buklod_community_destination_v3(uuid), authenticated EXECUTE, no anonymous grant, and a one-active-destination unique index. 30-day switch lock from current private.buklod_pf_config.
- Preserve the new retired-faith-gate changes in main ca8e7e5. No reset to earlier branch or old public Home.
- Existing consolidated Nov09 OTA/web fixes on main remain intact.

## QA and release gate
- Static read-only checks and server catalog inspection were used to prepare this source candidate.
- User explicitly waived actual device/runtime verification. Do not present this as device-verified or a compiled signed artifact.
- Full release process remains DEV -> verified/frozen RC -> exact source OTA to production; skip device verification only as authorized, but require successful automated build and typecheck before actual publication.
- OTA publishing, web deployment and promotion to main are NOT part of this source preparation; no production client update occurred.
- Before production: verify target production channel/runtime association with installed client, compile exports and run focused Node/TypeScript checks, freeze exact commit SHA, then publish only with explicit release authorization.
- Preserve user data, personal/scope financial isolation, active membership filters, PTT functionality and existing navigation.
