#!/usr/bin/env node
// Fail-closed guard for the currently approved V28 Android binary.
// Update this registry only after independently verifying a new downloadable binary.
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const registry = JSON.parse(fs.readFileSync('release/android-native-runtime.json', 'utf8'));
const configFactory = require('../app.config.js');
const config = configFactory({ config: {} });
const fail = (reason) => { console.error('OTA GUARD BLOCKED: ' + reason); process.exit(1); };
const expected = registry.active;
if (process.env.BUKLOD_APP_TARGET && process.env.BUKLOD_APP_TARGET !== 'main') fail('Classroom target is not authorized');
if (process.env.APP_VARIANT && process.env.APP_VARIANT !== 'production') fail('Non-production variant');
if (process.env.EXPO_PUBLIC_APP_ENV && process.env.EXPO_PUBLIC_APP_ENV !== 'production') fail('Non-production app environment');
if (config.android?.package !== expected.package) fail('Android package mismatch');
if (config.android?.versionCode !== expected.versionCode) fail('Android versionCode mismatch');
if (config.version !== expected.versionName) fail('Android versionName mismatch');
if (config.runtimeVersion !== expected.embeddedRuntime) fail('Embedded runtime mismatch');
if (config.extra?.eas?.projectId !== expected.easProjectId) fail('EAS project mismatch');
if (process.env.OTA_CHANNEL !== expected.channel) fail('OTA channel mismatch');
if (process.env.OTA_PLATFORM !== 'android') fail('Non-Android OTA requested');
const head = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
if (!/^[a-f0-9]{40}$/.test(process.env.APPROVED_RC_SHA || '')) fail('Expected a full immutable RC SHA');
if (head !== process.env.APPROVED_RC_SHA) fail('Checkout does not match approved RC SHA');
if (process.env.RELEASE_CONFIRMATION !== 'PUBLISH_ANDROID_PRODUCTION') fail('Explicit production authorization missing');
console.log('OTA GUARD PASS: Android production runtime 1.3.2, exact approved RC ' + head);
