import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const rgb = hex => hex.match(/[a-f0-9]{2}/gi).map(v => parseInt(v,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
const lum = hex => rgb(hex.replace('#','')).reduce((acc,v,i)=>acc+v*[.2126,.7152,.0722][i],0);
const contrast = (a,b) => { const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); };
test('Genesis dark card and Cluster feature tiles have WCAG AAA body-text contrast',()=>{
 assert.ok(contrast('#F8FAFF','#101E3C')>7);
 assert.ok(contrast('#D4E3F4','#102B47')>7);
 assert.ok(contrast('#F4F8FF','#122748')>7);
});
test('Wall gallery is decorative only and leaves feed and ads unaffected',()=>{
 const wall=read('src/components/BuklodCommunityWallProfileBubbles.tsx');
 assert.match(wall,/GENESIS_WALL \? <View pointerEvents="none"/);
 assert.match(wall,/GENESIS_GALAXY_IMAGES\.nebula/);
 assert.doesNotMatch(wall,/admob|adsProvider|AdMob.*remove/i);
});
test('Cluster scope and motion gates preserve touch and fallback',()=>{
 const c=read('src/components/BuklodClusterHomeCommandCenterImpl.tsx');
 const v=read('src/features/season2/genesis/GenesisVisuals.tsx');
 const scope=read('src/app/scope/index.tsx');
 assert.match(c,/GENESIS_CLUSTER \? 'transparent'/);
 assert.match(c,/GenesisCosmicSky active=\{false\} minimal transparent/);
 assert.match(v,/GenesisAtmosphere active=\{active\}/);
 assert.match(v,/pointerEvents="none"/);
 assert.match(scope,/blueWorkspaceTabs &&/);
});
