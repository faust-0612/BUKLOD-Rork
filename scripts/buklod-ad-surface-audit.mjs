#!/usr/bin/env node
/**
 * Source-only Android monetization coverage inventory. This never creates
 * impressions, mutates accounts, calls AdMob, or recommends ads for each tap.
 * It deliberately reports REVIEW candidates instead of making unsafe edits.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = path.join(root, 'src', 'app');
const safePath = value => value.replaceAll(path.sep, '/');

const RESTRICTED = /(^|\/)(?:\(auth\)|auth|account|admin|system|bsoc|onboarding|moderation|privacy|policy|delete-account|support|help|settings|feedback|contact-us|reports|office)(\/|$)|(^|\/)(?:[+]not-found|[+]native-intent)/i;
const CLINICAL = /(^|\/)(?:health|prayer|emergency|child-safety)(\/|$)|buklod-health|consultation/i;
const SCHOOL = /(?:classroom|faculty|student|grade|assessment|quiz|quick-check|exam|attendance)/i;
const FINANCE = /(?:bayanihan\/(?:payout|withdraw)|giving|scope-fund|payment|checkout|financial|bank|payout-profile)/i;
const LIVE_CONVERSATION = /(?:connect\/(?:community|personal|\[id\])|messages?\/\[|ptt|call|live-chat)/i;
const SENSITIVE_OPERATIONS = /^(?:(?:organizations|clusters)\/(?:admins|admin-module|manage|settings)|scope\/(?:attendance|faith-monitoring|manage)|(?:giving|bayanihan\/withdrawals|premium)(?:\/|$)|faith\/bible-quiz\.tsx$|prayer\/new\.tsx$)/i;
const GAMEPLAY = /(^|\/)games\/[^/]+\.tsx$/i;

const count = (source, pattern) => (source.match(pattern) ?? []).length;
function listScreens(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listScreens(full, results);
    else if (entry.isFile() && entry.name.endsWith('.tsx')) results.push(full);
  }
  return results;
}

export function auditBuklodAdSurfaces(base = appRoot) {
  const screens = listScreens(base);
  const routes = screens.map(file => {
    const route = safePath(path.relative(base, file));
    const source = fs.readFileSync(file, 'utf8');
    const buttons = count(source, /<Pressable\b|<TouchableOpacity\b|<TouchableHighlight\b|<Button\b/g);
    const pressHandlers = count(source, /\bonPress\s*=|\bonClick\s*=/g);
    const mutations = count(source, /\.(?:insert|update|upsert|delete)\s*\(|\.rpc\s*\(/g);
    const submissionWords = /\b(?:publish|submit|save|create|claim|unlock|redeem|verify|join)\b/i.test(source);
    const passiveAds = /Buklod(?:FirstViewAd|ScreenBottomBanner|NativeSponsoredCard|CommunityInlineAd|AdMobBanner|ReelsInlineAd|SubmissionAdSlot|KingdomAdSlot)/.test(source);
    const fullScreenEvents = /showBuklodAdOpportunity|maybeShowBuklodInterstitial/.test(source);

    let category = 'general';
    if (RESTRICTED.test(route)) category = 'restricted';
    else if (CLINICAL.test(route)) category = 'clinical-or-private';
    else if (SCHOOL.test(route)) category = 'learning-sensitive';
    else if (FINANCE.test(route)) category = 'financial';
    else if (LIVE_CONVERSATION.test(route)) category = 'live-conversation';
    else if (GAMEPLAY.test(route)) category = 'active-gameplay';
    else if (SENSITIVE_OPERATIONS.test(route)) category = 'sensitive-operation';

    const protectedFromInterstitials = category !== 'general';
    const reviewMissingSuccessBreak = !protectedFromInterstitials &&
      submissionWords && mutations > 0 && pressHandlers > 0 && !fullScreenEvents;

    return {
      route, category, buttons, pressHandlers, mutations,
      passiveAds, fullScreenEvents,
      recommendation: protectedFromInterstitials
        ? 'NO_GENERIC_INTERSTITIAL'
        : reviewMissingSuccessBreak
          ? 'REVIEW_VERIFIED_SUCCESS_BREAK'
          : !passiveAds && buttons > 0
            ? 'REVIEW_PASSIVE_VIEWPORT_SLOT'
            : 'CHECK_EXISTING_SLOTS',
    };
  });
  routes.sort((a, b) => a.route.localeCompare(b.route));
  return {
    summary: {
      routeFiles: routes.length,
      withPressHandlers: routes.filter(r => r.pressHandlers > 0).length,
      restrictedOrSensitive: routes.filter(r => r.category !== 'general').length,
      withDirectPassiveSlots: routes.filter(r => r.passiveAds).length,
      withDirectCompletionHooks: routes.filter(r => r.fullScreenEvents).length,
      reviewVerifiedSuccessBreak: routes.filter(r => r.recommendation === 'REVIEW_VERIFIED_SUCCESS_BREAK').length,
      reviewPassiveViewportSlot: routes.filter(r => r.recommendation === 'REVIEW_PASSIVE_VIEWPORT_SLOT').length,
      categoryCounts: Object.fromEntries([...new Set(routes.map(r => r.category))].sort().map(category => [category, routes.filter(r => r.category === category).length])),
      recommendationCounts: Object.fromEntries([...new Set(routes.map(r => r.recommendation))].sort().map(recommendation => [recommendation, routes.filter(r => r.recommendation === recommendation).length])),
    },
    routes,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditBuklodAdSurfaces();
  if (process.argv.includes('--summary')) {
    process.stdout.write(JSON.stringify(report.summary, null, 2) + '\n');
  } else {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  }
}
