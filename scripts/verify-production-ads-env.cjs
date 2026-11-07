#!/usr/bin/env node
'use strict';

/**
 * BUKLOD_ADMOB_PRODUCTION_ENV_LOCK_R1
 *
 * Runs INSIDE `eas env:exec production` before a frozen Android RC export.
 * Never print unit IDs, publisher IDs, tokens or any environment value.
 * Missing live inventory must not quietly ship as test ads or empty slots.
 */
function env(name) { return String(process.env[name] ?? '').trim(); }
function realUnit(name) {
  const value = env(name);
  return /^ca-app-pub-\d{16}\/\d+$/.test(value) &&
    !value.startsWith('ca-app-pub-3940256099942544/');
}
function anyUnit(names) { return names.some(realUnit); }

const errors = [];
if (env('EXPO_PUBLIC_APP_ENV') !== 'production') {
  errors.push('EXPO_PUBLIC_APP_ENV must be production');
}
if (env('EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS').toLowerCase() !== 'true') {
  errors.push('EXPO_PUBLIC_ADS_ALLOW_LIVE_IDS must explicitly enable live units');
}
const checks = {
  home_banner: ['EXPO_PUBLIC_ADMOB_HOME_BANNER_UNIT_ID', 'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID'],
  community_banner: ['EXPO_PUBLIC_ADMOB_COMMUNITY_BANNER_UNIT_ID', 'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID'],
  connect_banner: ['EXPO_PUBLIC_ADMOB_MESSAGES_BANNER_UNIT_ID', 'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID'],
  content_banner: ['EXPO_PUBLIC_ADMOB_CONTENT_BANNER_UNIT_ID', 'EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID'],
  interstitial: ['EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID'],
  large_native: ['EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID'],
};
for (const [name, alternatives] of Object.entries(checks)) {
  if (!anyUnit(alternatives)) errors.push(name + ' requires a real production AdMob unit');
}
const rewardedConfigured = realUnit('EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID');
const reelsNativeConfigured = realUnit('EXPO_PUBLIC_ADMOB_REELS_NATIVE_UNIT_ID') ||
  realUnit('EXPO_PUBLIC_ADMOB_COMMUNITY_NATIVE_UNIT_ID');

if (errors.length) {
  console.error('BUKLOD production AdMob configuration FAIL: ' + errors.join('; '));
  process.exitCode = 1;
} else {
  console.log('BUKLOD production AdMob configuration PASS: live mode and Home, Wall, Connect, content, interstitial, large-native inventory configured.');
  console.log('Optional rewarded inventory: ' + (rewardedConfigured ? 'configured' : 'NOT CONFIGURED — feature remains unavailable; no substitute rewards'));
  console.log('Reels native inventory: ' + (reelsNativeConfigured ? 'configured' : 'NOT CONFIGURED — banner fallback applies'));
}
