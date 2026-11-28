# BUKLOD Empire signed content

Static content directory for the standalone Android Empire updater, ABI empire-content-v2.

Publish immutable `bundles/<sha256>.bundle` files first and the signed `manifest.json` last. A fresh channel has no active revision until a signed manifest and its matching bundles have been verified. Keep the private RSA signing key on the signing workstation outside Git. This channel is separate from MAIN and serves only reviewed, redistributable Empire content.
