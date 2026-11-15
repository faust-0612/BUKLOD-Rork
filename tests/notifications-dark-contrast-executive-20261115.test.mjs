import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const screen=read('src/app/notifications/index.tsx');
const actions=read('src/components/ClusterNotificationActions.tsx');
const palette=read('src/lib/buklodTheme.ts');
const ids=['cloudWhite','softMint','sage','sky','lavenderMist','sandCream','nightPine','graphite','lightMint','warmSoft','softRose','midnight'];
function luminance(hex){const x=[0,2,4].map(i=>parseInt(hex.slice(i+1,i+3),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return x[0]*.2126+x[1]*.7152+x[2]*.0722}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test('notification title, body, time meet WCAG AA on every active card palette',()=>{
 for(const id of ids){
  const block=palette.match(new RegExp('  '+id+': \\{([\\s\\S]*?)\\n  \\},'))?.[1];
  assert.ok(block,id+' preset exists');
  const get=k=>block.match(new RegExp(k + ": '(#[0-9a-fA-F]{6})'"))?.[1];
  const surface=get('surface');
  for(const role of ['textPrimary','textSecondary','textMuted']){
   const fg=get(role);
   assert.ok(fg&&surface,id+' '+role+' exists');
   assert.ok(contrast(fg,surface)>=4.5,id+' '+role+' ratio '+contrast(fg,surface).toFixed(2));
  }
 }
});
test('notifications render reactive theme instead of legacy fixed dark text',()=>{
 assert.match(screen,/useThemedShared\(\)/);
 assert.match(screen,/useBuklodTheme\(\)/);
 assert.match(screen,/themedShared\.screen/);
 assert.match(screen,/StatusBar style=\{isDark\?'light':'dark'\}/);
 assert.match(screen,/s\.title,\{color:theme\.textPrimary/);
 assert.match(screen,/s\.body,\{color:theme\.textSecondary/);
 assert.match(screen,/s\.time,\{color:theme\.textMuted/);
 assert.doesNotMatch(screen,/colors\.text|shared\.screen|shared\.h1/);
 assert.match(screen,/ItemSeparatorComponent/);
 assert.match(screen,/Mark all read/);
});
test('cluster notification decision buttons use accessible palette colors',()=>{
 assert.match(actions,/useBuklodTheme\(\)/);
 assert.match(actions,/backgroundColor: theme\.buttonPrimary/);
 assert.match(actions,/color: theme\.onAccent/);
 assert.match(actions,/backgroundColor: theme\.surface/);
 assert.match(actions,/color: theme\.textPrimary/);
 assert.match(actions,/minHeight: 44/);
 assert.doesNotMatch(actions,/backgroundColor: '#FFFFFF'/);
});
