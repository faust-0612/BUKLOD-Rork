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
if (process.env.GITHUB_REF_TYPE !== 'tag') fail('Publish must run from an immutable release tag');
if (!/^v28-runtime-132-[a-f0-9]{8,40}$/.test(process.env.GITHUB_REF_NAME || '')) fail('Unexpected release tag');
{
  const tag = execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim();
  const short = (process.env.GITHUB_REF_NAME || '').split('-').at(-1);
  if (!tag.startsWith(short)) fail('Tag does not identify checkout commit');
}
console.log('OTA GUARD PASS: ' + JSON.stringify({package:expected.package,versionName:expected.versionName,versionCode:expected.versionCode,runtime:expected.embeddedRuntime,channel:expected.channel,project:expected.easProjectId}));
