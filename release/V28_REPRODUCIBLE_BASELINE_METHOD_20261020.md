# Controlled V28 baseline verification

This is a verification procedure, not a parity assertion or permission to publish.

1. Pin upstream source commit `4f564977a1cf1c521e40d332278edd437d23c030` and tree `b9410df25ce5f29dc40113ffbde9136b5158972f`. Verify each product source/asset against `V28_BASELINE_4F56497.json`. Track test-infrastructure changes separately; do not change runtime package versions or protected product modules.
2. Pin the APK SHA-256 `820ff2c74e63a63a371b7b88466b24c4b0c324b1ae619a140e241c719f428a95`. Audit its embedded Hermes bundle, Expo asset manifest and exact resource-byte matches using `scripts/verify-v28-apk-provenance.py`. Preserve the evidence gap if the original build-source binding is unavailable.
3. Restore dependencies with the lockfile, a fixed Node/npm toolchain, no native prebuild and no install scripts. Record package/lock hashes and exact SDK versions. The new test dependencies repair the repository's existing Jest setup; they do not change previously locked package versions.
4. Export Android JS/assets twice to separate empty scratch directories from the same pinned product source, lockfile and explicit public environment. Record hashes of public environment inputs; never place credentials or private keys in a manifest. Compare every emitted JS/asset file. No native APK/AAB is built.
5. The exports attempted in this run use deliberate `.invalid` test endpoint/public placeholders and are not production artifacts. Even identical exports under these inputs would demonstrate controlled candidate reproducibility only. Reproducing the original APK requires its original toolchain, lockfile, source, public environment inputs and export options. Do not compare placeholder-environment output to production and claim equivalence.
6. If the original build manifest/source map cannot be recovered, retain the APK as the independently fingerprinted native baseline and qualify the cumulative Git source as a new candidate through full regression, protected contracts, reproducible export and Android candidate-device verification. This alternative does not close historical APK/source parity automatically, nor authorize publishing while a mandatory gate remains unresolved.
7. Freeze only the exact verified candidate artifact, recording Git tree, lockfile, source/assets, exported bundle and environment-input hashes plus all test/device results. Record the actual frozen artifact identity before any future publication. Current status is CANDIDATE / UNFROZEN.

The local verification worktree was reconstructed from hash-verified GitHub objects and the exact upstream tree. Its local verification commit is deliberately distinct from the upstream commit; it is not claimed to be an authenticated clone or a production release identity. Missing or mismatching files are reported rather than excluded silently.

## Actual outcome

Both controlled Android JS exports completed. Each contains 247 files. Exactly one file differs: the generated Hermes bytecode bundle. The bundles have equal lengths (16,727,336 bytes) and equal embedded source-hash headers, but differ at 39 byte positions including their 20-byte trailing checksums. These observations do not prove semantic or byte equivalence. No bytes were normalized or removed to force a passing result. Reproducibility remains blocked; the per-file hashes for both exports are retained in the provenance evidence.

The APK resource audit verified 193 repository assets as byte-identical inside the APK. All 1,217 tracked product source/asset files in the controlled worktree match the pinned upstream baseline. Neither result supplies the missing original Hermes-to-source binding.
