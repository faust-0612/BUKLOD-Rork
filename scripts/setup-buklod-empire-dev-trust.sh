#!/usr/bin/env bash
# Run once on an owner-controlled machine, NOT in an Actions runner or in chat.
set -euo pipefail
umask 077
REPO=faust-0612/BUKLOD-Rork
ENVIRONMENT=buklod-empire-dev
KEYDIR="${BUKLOD_EMPIRE_KEYDIR:-$HOME/.local/share/buklod-empire/dev-keys}"
for cmd in openssl keytool gh node base64; do command -v "$cmd" >/dev/null; done
gh auth status >/dev/null
# Require a pre-existing protected environment rather than silently opening secret access.
gh api "repos/$REPO/environments/$ENVIRONMENT" >/dev/null
mkdir -p "$KEYDIR"; chmod 700 "$KEYDIR"
existing="$(gh variable list -R "$REPO" --env "$ENVIRONMENT" --json name,value --jq '.[] | select(.name=="BUKLOD_EMPIRE_OTA_PUBLIC_KEY") | .value')"
if [ -n "$existing" ] && [ ! -f "$KEYDIR/ota-private.pem" ]; then
 echo "Existing trust root; restore original private key from secure owner backup." >&2
 exit 1
fi
if [ ! -f "$KEYDIR/ota-private.pem" ]; then
 openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$KEYDIR/ota-private.pem" 2>/dev/null
fi
openssl pkey -in "$KEYDIR/ota-private.pem" -pubout -out "$KEYDIR/ota-public.pem"
if [ -n "$existing" ] && [ "$(printf '%s' "$existing" | openssl pkey -pubin -outform DER | openssl dgst -sha256)" != "$(openssl pkey -pubin -in "$KEYDIR/ota-public.pem" -outform DER | openssl dgst -sha256)" ]; then
 echo "Trust root mismatch; refusing key rotation." >&2; exit 1
fi
existing_cert="$(gh variable list -R "$REPO" --env "$ENVIRONMENT" --json name,value --jq '.[] | select(.name=="BUKLOD_EMPIRE_APK_CERT_SHA256") | .value')"
if [ -n "$existing_cert" ] && [ ! -f "$KEYDIR/empire.p12" ]; then
 echo "Existing APK signer; restore the original keystore." >&2; exit 1
fi
if [ ! -f "$KEYDIR/empire.p12" ]; then
 if [ ! -f "$KEYDIR/keystore-password" ]; then openssl rand -hex 32 > "$KEYDIR/keystore-password"; fi
 export BUKLOD_KEYPASS="$(cat "$KEYDIR/keystore-password")"
 keytool -genkeypair -keystore "$KEYDIR/empire.p12" -storetype PKCS12 -alias empire -keyalg RSA -keysize 3072 -validity 10000 -dname 'CN=BUKLOD Empire DEV' -storepass:env BUKLOD_KEYPASS -keypass:env BUKLOD_KEYPASS >/dev/null 2>&1
fi
export BUKLOD_KEYPASS="$(cat "$KEYDIR/keystore-password")"
cert="$(keytool -exportcert -keystore "$KEYDIR/empire.p12" -alias empire -storepass:env BUKLOD_KEYPASS | openssl dgst -sha256 | awk '{print $NF}')"
if [ -n "$existing_cert" ] && [ "$existing_cert" != "$cert" ]; then echo "APK signer mismatch" >&2; exit 1; fi
# Storage access stays on the trusted owner machine. Never reuse an AdMob credential.
node scripts/buklod-empire-storage.mjs provision
gh variable set BUKLOD_EMPIRE_OTA_PUBLIC_KEY -R "$REPO" --env "$ENVIRONMENT" < "$KEYDIR/ota-public.pem"
gh variable set BUKLOD_EMPIRE_APK_CERT_SHA256 -R "$REPO" --env "$ENVIRONMENT" --body "$cert"
base64 -w0 "$KEYDIR/empire.p12" | gh secret set BUKLOD_EMPIRE_KEYSTORE_B64 -R "$REPO" --env "$ENVIRONMENT"
gh secret set BUKLOD_EMPIRE_KEYSTORE_PASSWORD -R "$REPO" --env "$ENVIRONMENT" < "$KEYDIR/keystore-password"
unset BUKLOD_KEYPASS
echo "Owner trust provisioned. Back up the protected key directory offline. OTA private key stays owner-side."
