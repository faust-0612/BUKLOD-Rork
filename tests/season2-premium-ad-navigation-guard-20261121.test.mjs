import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');

test('Premium Genesis map honors auth/compliance/mandatory-update before guide and map, while Home keeps ads',()=>{
 const map=read('src/app/buklod-map.tsx');
 const guard=[
  "if (!isGenesisPreviewBuild())",
  "if (!session)",
  "if (config?.maintenance_mode)",
  "if (config?.update_required)",
  "if (requiresAcceptance)",
  "if (!profile)",
 ];
 const mapIndex=map.indexOf('<GenesisApprovedEntryMap');
 assert.ok(mapIndex>0,'Approved map must be present');
 for(const token of guard){
  const at=map.indexOf(token);
  assert.ok(at>=0&&at<mapIndex,'Auth/privacy gate must precede map: '+token);
 }
 assert.match(map,/BuklodAdMobBanner/);
 assert.match(map,/placementId="genesis_entry_footer_banner"/);
 const home=read('src/app/(tabs)/hub.tsx');
 assert.match(home,/BuklodFirstViewAd placement="home" placementId="new_home_first_view"/);
 assert.doesNotMatch(home,/<Redirect href="\/buklod-map"/);
 assert.match(map,/GenesisApprovedEntryMap[\s\S]*onOpen/);
 assert.match(map,/router\.push\(route as any\)/);
});
test('Kingdom retains AdMob and launches in-app Arena only through Genesis portal',()=>{
 const games=read('src/app/games/index.tsx');
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(games,/BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner"/);
 assert.match(games,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(portal,/GENESIS_REALMS/);
 assert.match(portal,/onPress=\{\(\)=>\{ void pulseGenesisTouch/);
 assert.match(portal,/router\.push\('\/games\/empire-arena'/);
 assert.doesNotMatch(portal,/onPress.*awardBp|supabase\.rpc/);
});
test('Audio focus/first-view prewarm protection remains bounded when switching dashboards',()=>{
 const audio=read('src/features/games/runtime/rorkAudio.ts');
 const tab=read('src/app/(tabs)/_layout.tsx');
 const warm=read('src/components/BuklodDashboardAdWarmup.android.tsx');
 assert.match(audio,/subscribeBuklodAudioFocus/);
 assert.match(audio,/interruptedByOtherAudio = true/);
 assert.match(audio,/if \(focusedKingdomViews === 0 \|\| AppState\.currentState !== 'active'\)/);
 assert.match(tab,/<BuklodDashboardAdWarmup \/>/);
 assert.match(tab,/freezeOnBlur: true/);
 for(const s of ['MAX_WARM_CREATIVES = 2','NATIVE_WARM_TTL_MS = 30 * 60_000',
   'isBuklodPassiveAdAllowed','reserveBuklodPassiveAdRequest']){
  assert.ok(warm.includes(s),'Lost bounded prewarm: '+s);
 }
});

test('Genesis Wall and Connect clear status bar without moving other dashboards',()=>{
 const tab=read('src/app/(tabs)/_layout.tsx');
 const home=read('src/app/(tabs)/hub.tsx');
 for(const piece of [
   'const genesisDashboardTopInset =',
   "Platform.OS !== 'web' &&",
   'isGenesisPreviewBuild() &&',
   "['/buklod', '/messages'].includes(normalizeBuklodPathname(pathname))",
   'Math.max(0, insets.top) + 4',
   'paddingTop: genesisDashboardTopInset,',
 ]) assert.ok(tab.includes(piece),'Missing Genesis clearance guard: '+piece);
 assert.ok(tab.includes('!desktopWebShell && !isGenesisPreviewBuild() ? <SwipeDashboardHeader /> : null'),
   'Do not change production header behavior');
 assert.ok(home.includes('const genesisPreview = isGenesisPreviewBuild()'),
   'Home remains independently controlled');
 assert.ok(!tab.includes("['/buklod', '/messages', '/hub'"),'Do not shift other dashboards');
});
