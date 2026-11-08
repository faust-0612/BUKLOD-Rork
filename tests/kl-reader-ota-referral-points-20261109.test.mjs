import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../'+path,import.meta.url),'utf8');
const drawer=read('src/lib/smartDrawer/classify.ts');
const note=read('src/app/drawer/quick-note.tsx');
const klRpc=read('src/lib/kabihasnang-ligaw/rpc.ts');
const klSocial=read('src/lib/kabihasnang-ligaw/readerSocial.ts');
const klAudio=read('src/components/kabihasnang-ligaw/KlChapterAudio.tsx');
const klCopy=read('src/lib/kabihasnang-ligaw/copy.ts');
const wall=read('src/app/(tabs)/buklod.tsx');
const picker=read('src/components/BuklodPostMusicPicker.tsx');
const timeline=read('src/components/BuklodMusicClipTimeline.tsx');
const referral=read('src/lib/buklodRewards.ts');
const money=read('src/app/bayanihan/index.tsx');
const language=read('src/app/preferences/language.tsx');
const profile=read('src/app/(tabs)/me.tsx');
const ledger=read('src/lib/buklodEconomyLedger.ts');
const points=read('src/components/points/BuklodPointsRewardsScreen.tsx');
const klMigration=read('supabase/migrations/20261109040000_kl_reader_time_count_reconciliation.sql');
const referralMigration=read('supabase/migrations/20261109051000_buklod_referral_code_and_status_consistency.sql');
const resolver=read('supabase/migrations/20261109053500_buklod_signup_dual_referral_code_resolver.sql');

test('Drawer prose remains prose by default; explicit bullets and user opt-in remain supported',()=>{
  assert.match(drawer,/const lines = forceList/);
  assert.match(drawer,/normalized\.split\(\/\\r\?\\n\/\)\.filter/);
  assert.match(drawer,/explicit_list_markers/);
  assert.match(note,/Gawing checklist \(optional\)/);
  assert.match(note,/router\.replace\(`\/drawer\/item\/\$\{result\.item\.id\}/);
});
test('KL completion uses server 60 seconds and two spaced pings, cumulative reader count and auth comments',()=>{
  assert.match(klMigration,/interval '60 seconds'/);
  assert.match(klMigration,/ping_count<2/);
  assert.match(klMigration,/CREATE OR REPLACE FUNCTION public\.kl_list_readers_v2/);
  assert.match(klRpc,/kl_reading_progress_v1/);
  assert.match(klRpc,/kl_list_readers_v2/);
  assert.match(klRpc,/kl_reader_comments_v2/);
  assert.match(klRpc,/kl_post_comment_v1/);
  assert.match(klSocial,/p_action: 'ping'/);
  assert.match(klSocial,/p_parent_id: null/);
  assert.match(klSocial,/trimmed\.length < 12/);
  assert.match(klAudio,/useFocusEffect\(useCallback/);
  assert.match(klAudio,/player\.pause\(\)/);
  assert.match(klCopy,/Mga reaksyon at repleksyon/);
  assert.match(klCopy,/bumasa/);
});
test('Wall samples and loops fixed 30-second music segment, account-safe URL cache and editor preview',()=>{
  assert.match(picker,/fixedLength=\{30\}/);
  assert.match(picker,/Preview selected 30s loop/);
  assert.match(picker,/onSelect\(item,start,30\)/);
  assert.match(timeline,/n\.fixedLength\?'move'/);
  assert.match(wall,/wallClipLoopingRef\.current=true/);
  assert.match(wall,/player\.seekTo\(clip\.start\)/);
  assert.match(wall,/const duration=30/);
  assert.match(read('src/lib/buklodPostCreatives.ts'),/accountScope \+ ':' \+ original/);
});
test('Sharing exposes canonical code with safely deduped historical invitations, not invented payout',()=>{
  assert.match(referral,/get_my_buklod_referral_reconciliation_v1/);
  assert.match(referral,/attachBuklodReferral\(canonicalCode\)/);
  assert.match(referral,/buklod_record_referral_v1/);
  assert.match(money,/referralAudit\.invited_count/);
  assert.match(money,/Historical invitations do not create cash balances/);
  assert.match(referralMigration,/'referral_code',coalesce\(v_financial_code,''\)/);
  assert.match(referralMigration,/'was_referred',v_was_referred/);
  assert.match(resolver,/canonical_referral_code/);
  assert.doesNotMatch(referralMigration,/insert into private\.buklod_pf_referrals/i);
});
test('Language is under Profile, not Economy, and only approved packs are selectable',()=>{
  assert.match(profile,/title="App Language"/);
  assert.match(language,/availableLanguages\.map/);
  assert.match(language,/setPreference\(code\)/);
  assert.doesNotMatch(money,/router\.push\('\/preferences\/language'/);
});
test('Points screen and Economy use account-isolated short caches and explicit refresh',()=>{
  assert.match(ledger,/ledgerSnapshots\.get\(userId\)/);
  assert.match(ledger,/ledgerInFlight\.set\(userId, request\)/);
  assert.match(points,/pointsViewCache\.get\(accountId\)/);
  assert.match(points,/await load\(true\)/);
});
