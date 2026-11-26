# Isolated APK preparation — 2026-11-26
This DEV candidate retains the integrated gameplay and online source from 2ec84fb93d7f19c6137d09a93a05a6c0a6ee8055 and imports the three reconstruction review files unchanged from bfac0e691a8830cb8e32db70279d0624e4469e82. No production asset receipt, deployment, or online service is authorized by this document.

From apps/buklod-empire-unity:
- `node Tools/run-offline-test-build.mjs --prepare`: generate/hash-check candidate assets with existing local Python and Node dependencies.
- `node Tools/run-offline-test-build.mjs --build <absolute Unity executable> <absolute Android build-tools directory>`: explicit local graphics-capable build with the pinned licensed editor, Android modules, Python dependencies and JDK. No cloud invocation. This prepares assets, creates a review-only URP configuration if no pipeline exists, uses the existing isolated APK builder, restores graphics settings, then verifies APK identity, signature and native libraries. A stale lock after interruption requires checking no build remains active before manual removal. The existing production guard is unchanged.
- Actual game/device checks may be deferred at owner request, but do not claim they passed. Unity compilation, generated asset integrity and APK verification must succeed for a test artifact.

Final offline+online APK still requires approved individually reconstructed models, production catalog, generated scene and NavMesh, and operational isolated Auth/HTTPS/WSS/settlement services. Do not substitute this offline test artifact for final delivery or alter MAIN. No Unity compilation was executed in this session.
