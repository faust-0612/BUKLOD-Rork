import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const read=p=>readFileSync(resolve(root,p),'utf8');

test('Premium Genesis map honors auth/compliance/mandatory-update before first view ads',()=>{
 const map=read('src/app/buklod-map.tsx');
 const guard=[
  "if (!isGenesisPreviewBuild())",
  "if (!session)",
  "if (config?.maintenance_mode)",
  "if (config?.update_required)",
  "if (requiresAcceptance)",
  "if (!profile)",
 ];
 const ad=map.indexOf('<BuklodFirstViewAd placement="home" placementId="new_home_first_view"');
 assert.ok(ad>0,'Approved first-view placement must not be removed');
 for(const token of guard){
  const at=map.indexOf(token);
  assert.ok(at>=0&&at<ad,'Auth or privacy guard must precede first-view AdMob: '+token);
 }
 assert.match(map,/GenesisValleyMap[\s\S]*selectedHotspotId/);
 assert.match(map,/router\.push\(\(selectedHotspot\?\.route/);
});
test('Kingdom retains canonical footer AdMob and official character navigation, with no Arena route',()=>{
 const games=read('src/app/games/index.tsx');
 const portal=read('src/features/season2/genesis/GenesisKingdomPortal.tsx');
 assert.match(games,/BuklodKingdomAdSlot placementId="kingdom_map_footer" kind="banner"/);
 assert.match(games,/genesisPreview \? <GenesisKingdomPortal \/> : <BuklodKingdomMap \/>/);
 assert.match(portal,/GENESIS_REALMS/);
 assert.match(portal,/onPress=\{\(\)=>\{ void pulseGenesisTouch/);
 assert.doesNotMatch(portal,/empire-arena|onPress.*awardBp|supabase\.rpc/);
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
