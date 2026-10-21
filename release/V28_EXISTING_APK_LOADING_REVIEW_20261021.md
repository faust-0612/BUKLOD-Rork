# Existing 28.apk safe candidate-loading review — 21 October 2026

**Status: INCOMPLETE / CLOUD COMMAND SERVICE BLOCKED. OTA NOT READY; RC UNFROZEN.** This is not a finding that the APK is technically incapable of preview loading.

## APK reused; retained evidence only

Use the already-provided cloud copy `/workspace/scratch/857a6d387c7d/apk/28.apk`. No upload, download, APK alteration or installation was requested or performed.

- Prior verified APK SHA-256: `820ff2c74e63a63a371b7b88466b24c4b0c324b1ae619a140e241c719f428a95`.
- Package `org.mzbministry.buklod`, version 1.3.4, code 28; retained runtime 1.3.4.
- Retained update URL/project `https://u.expo.dev/23dad7d0-389a-406e-8dec-08965dab85d8`, channel header `production`.
- Embedded update ID `d1b48c00-58c2-4c99-9cb4-f0b8bcd723f0`, commitTime 1792169442166; embedded bundle SHA-256 `38a36b0a5ab7533f487ea227d47450805b4ac39cb7a5e96f3e2a57a8fadfc939`, Hermes bytecode 98.

These facts are retained from prior APK/provenance evidence, not freshly rehashed or parsed in this continuation. Matching runtime/Hermes labels or assets alone do not establish native-module compatibility, APK/source parity or development-client behavior.

## Fresh work and bounded blocker

GitHub DEV was verified at `8e526fb3f92196e57c43888b5bce6bed2eacfedc`. The existing provenance inventory and official Expo preview/override/channel/runtime guidance were reviewed. No broad resource rediscovery or test rerun occurred.

The cloud command service returned no completed shell result for the APK/tool inspection or a separately bounded two-second no-op. Those orchestration cells were stopped. Two subsequent narrow APK ZIP/parser-inventory requests each reached a 20-second tool-transport deadline with `completed_shell_result=false`. Shell commands themselves were bounded to ten seconds plus kill grace, but no result established that they started. Therefore this continuation does not assert fresh APK presence/hash, parser availability or binary-inspection output. No owner-PC fallback was used.

A transient orchestration-state loss initially triggered a mistaken branch-change warning; a fresh GitHub ref read confirmed the branch remained unchanged. No repository mutation occurred before that was resolved.

## Requested evidence disposition

| Field / mechanism | Current evidence boundary |
| --- | --- |
| APK identity, runtime, project URL, production channel and embedded update | Retained results above. |
| Updates enabled, check-on-launch policy, launch wait | Still UNVERIFIED by the requested fresh embedded binary inspection. Do not substitute app-config defaults. |
| Anti-bricking setting and full request-header metadata | Still UNVERIFIED. No setting may be enabled, patched or bypassed. Header/token values were not exposed. |
| Dev-launcher activities/enablement, exported flags, deep-link filters | Still UNVERIFIED. A dev-client dependency, configured build profile, scheme or native class name is not proof of an enabled development launcher. |
| Reachable embedded JS override/selector | Still UNVERIFIED. Generic native/JS API strings are insufficient; a real embedded route and call chain must be shown. |
| Native module compatibility with exact DEV candidate | Not established merely by matching version/runtime/bytecode labels or by the candidate making no native edits. Historical source binding remains unproven. |
| Existing authorized non-production exact-candidate update/channel | Not established in retained evidence; no new service discovery, publication or remapping attempted. Profile names are not deployments or authorization. |

## Candidate-loading verdict

**A safe non-production loading route for this exact APK and exact DEV candidate is NOT ESTABLISHED / BLOCKED, not technically disproven.** Its retained configured route is production; using the embedded baseline is not candidate verification.

Technical capability, existing reachable route and owner authorization are separate. Expo release builds may support header/channel switching when an app-level trigger is already implemented; development-client selection is distinct. URL override additionally requires the appropriate native anti-bricking configuration and must not be enabled/bypassed as a shortcut. No SDK API presence is permission to invoke it. A generic deep link cannot be assumed to change the update target.

This authorization permits inspection only: no publication to any channel, production channel remapping, APK patch/rebuild/install, database mutation or production account tests. No potentially valid mechanism was exercised.

## Minimum missing requirement and precise continuation

Restore responsive read-only cloud command execution for the **existing APK**, without requesting re-upload or owner-PC execution. Then parse its binary AndroidManifest and referenced resources, native launcher/module enablement and embedded Hermes call paths with bounded offline tools. Establish exact flags/URL/runtime/headers/check policy/launch wait, dev-client enablement and any actually reachable selector including recovery behavior. Do not infer capability from strings alone.

Only if a safe prebuilt mechanism is demonstrated, verify an already-existing authorized non-production update matching exact candidate/runtime/native modules and safe backend inputs. If no such reachable route is demonstrated, do not manufacture one through production publication, remapping, rebuilding or anti-bricking bypass. Static inspection alone cannot certify successful launch or waive physical Android acceptance.

References: [Preview](https://docs.expo.dev/eas-update/preview/), [override](https://docs.expo.dev/eas-update/override/), [channel surfing](https://docs.expo.dev/eas-update/channel-surfing/), [runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

One documentation file only. Prior fixes/tests/export results remain retained, not rerun. No owner-PC writes/download/install/build, secret/query-token disclosure, paid resource, database operation, native build, main merge, version cutoff, publication or RC freeze.
