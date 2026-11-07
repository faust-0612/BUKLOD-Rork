import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL('../' + name, import.meta.url), 'utf8');
const profile = read('src/app/(tabs)/me.tsx');
const sponsor = read('src/components/BuklodSponsorSlot.tsx');
const header = read('src/components/BuklodHeaderSponsorLegacy.tsx');
const root = read('src/app/_layout.tsx');
const form = read('src/app/advertise/index.tsx');
const touch = read('src/components/BuklodPressable.tsx');
const guard = read('src/lib/buklodScopeRoute.ts');

const strip = profile.slice(
  profile.indexOf('function ProfileQuickActionsStrip('),
  profile.indexOf('function roleLabel('),
);

test('Profile Advertise remains tappable after any horizontal drag or zero-momentum release', () => {
  assert.ok(strip.length > 300, 'Profile quick actions must still mount');
  assert.match(strip, /horizontal\s*\n\s*nestedScrollEnabled/);
  assert.match(strip, /testID=\{\x60profile-quick-\$\{item\.key\}\x60\}/);
  assert.match(strip, /onPress=\{item\.onPress\}/);
  assert.doesNotMatch(strip, /disabled=\{horizontalDragging\}|setHorizontalDragging|onMomentumScrollEnd/);
  assert.match(profile, /key: 'advertise',[\s\S]*?label: 'Advertise',[\s\S]*?router\.push\('\/advertise'/);
  assert.match(touch, /buklodMovementExceeded/);
  assert.match(touch, /cancelled\.current/);
});

test('empty sponsor fallback is a real accessible CTA and routes into Advertise', () => {
  assert.match(sponsor, /import \{ router \} from 'expo-router'/);
  assert.match(sponsor, /accessibilityLabel="Advertise your business on BUKLOD"/);
  assert.match(sponsor, /testID="buklod-sponsor-advertise"/);
  assert.match(sponsor, /onPress=\{\(\) => router\.push\('\/advertise' as any\)\}/);
  assert.match(sponsor, /ADVERTISE YOUR BUSINESS HERE/);
  assert.match(sponsor, /sponsor \? \([\s\S]*?<Pressable[\s\S]*?onPress=\{open\}/);
  assert.match(sponsor, /disabled=\{[\s\S]*?!sponsor\.target_url/);
});

test('legacy header fallback opens the same form without hijacking paid sponsored clicks', () => {
  assert.match(header, /import \{ router \} from 'expo-router'/);
  assert.match(header, /accessibilityLabel="Advertise on BUKLOD"/);
  assert.match(header, /testID="buklod-header-advertise"/);
  assert.match(header, /onPress=\{\(\) => router\.push\('\/advertise' as any\)\}/);
  assert.match(header, /ADVERTISE HERE/);
  assert.match(header, /sponsor \? \([\s\S]*?<Pressable[\s\S]*?onPress=\{open\}/);
});

test('Advertise route is a real registered Stack screen, not a dead navigation target', () => {
  assert.match(root, /<Stack\.Screen name="advertise\/index" \/>/);
  assert.match(form, /export default function AdvertiseScreen\(\)/);
  assert.match(form, /<ScrollView contentContainerStyle=\{s\.content\} keyboardShouldPersistTaps="handled">/);
  assert.match(form, /<Pressable onPress=\{pickCreative\}/);
  assert.match(form, /<Pressable style=\{s\.proof\} onPress=\{pickProof\}/);
  assert.match(form, /<Pressable disabled=\{busy\} onPress=\{submit\}/);
  // Advertise is a personal/global form. Managed scope redirects cover only
  // HOME, CONNECT and WALL; do not rewrite /advertise to scoped workspace.
  const scoped = guard.slice(guard.indexOf('export function scopedWorkspacePathForGlobalRoute('),
    guard.indexOf('export type ScopedWorkspaceSection'));
  assert.ok(scoped.length > 0);
  assert.doesNotMatch(scoped, /['"]\/advertise/);
});

test('Advertise submission preserves review, payment verification and account isolation', () => {
  assert.match(form, /useAuth\(\)/);
  assert.match(form, /supabase\.from\('buklod_ad_self_service_rates'\)/);
  assert.match(form, /ensureImagePickerLibraryAccess/);
  assert.match(form, /\$\{user\.id\}\/\$\{folder\}/);
  assert.match(form, /if\(!user\?\.id\|\|busy\)return;/);
  assert.match(form, /if\(!reference\.trim\(\)\)/);
  assert.match(form, /media_duration_seconds:creative==='video'\?duration:null/);
  assert.match(form, /payment_status:'pending'/);
  assert.match(form, /status:'pending'/);
  assert.match(form, /amount_paid:0/);
  assert.match(form, /from\('buklod_paid_ad_campaigns'\)\.insert\(payload\)/);
  assert.match(form, /Could Not Submit/);
  assert.match(form, /Your advertisement was submitted for verification/);
  assert.doesNotMatch(form, /payment_status:'paid'|status:'approved'/);
});
