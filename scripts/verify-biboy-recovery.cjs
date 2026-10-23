#!/usr/bin/env node
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const manifest = JSON.parse(fs.readFileSync('release/biboy-recovery.json','utf8'));
const file = process.argv[2];
const observedUpdate = process.env.BIBOY_ACTIVE_UPDATE_ID;
assert.equal(manifest.name, 'BIBOY');
assert.equal(manifest.runtimeVersion, '1.3.2');
assert.equal(manifest.ota.channel, 'production');
assert.equal(manifest.ota.platform, 'android');
if (!file) { console.error('BLOCKED: supply verified native APK path'); process.exit(2); }
assert.ok(fs.existsSync(file), 'APK not found');
const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.ok(manifest.native.apkSha256, 'BLOCKED: approved APK SHA-256 not recorded');
assert.equal(sha, manifest.native.apkSha256, 'Native APK mismatch');
assert.ok(manifest.ota.rcBundleSha256, 'BLOCKED: frozen RC bundle hash missing');
assert.ok(observedUpdate, 'BLOCKED: device active OTA ID not provided');
assert.equal(observedUpdate, manifest.ota.updateId, 'Device OTA mismatch');
assert.equal(manifest.ota.deviceActiveVerified, true, 'Device confirmation pending');
assert.equal(manifest.backend.compatibilityVerified, true, 'Backend compatibility pending');
assert.equal(manifest.native.verified, true, 'Native baseline not verified');
console.log('BIBOY recovery identity checks PASSED; separately verify functional smoke tests before declaring rollback successful.');
