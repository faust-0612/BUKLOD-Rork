import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const theme = read('src/lib/buklodTheme.ts');
const visual = read('src/lib/buklodVisual.ts');
const messaging = read('src/lib/messagesTheme.ts');
const defaults = {
  cloudWhite: ['#F8FAFC', '#FFFFFF', '#EBF2FF', '#F1F5F9', '#2563EB'],
  softMint: ['#F0F7F4', '#FFFFFF', '#E3F2EA', '#F5FAF7', '#2D8B57'],
  sage: ['#EFF2EE', '#FAFBF9', '#E4EBE5', '#F3F6F2', '#6B8F71'],
  sky: ['#F0F6FC', '#FFFFFF', '#E3EEF8', '#F5F9FD', '#3B82C4'],
  lavenderMist: ['#F5F3FA', '#FDFCFE', '#EDE8F5', '#F8F6FC', '#7C6BA8'],
  sandCream: ['#FAF6F0', '#FFFCF7', '#F0EBE2', '#F5F0E8', '#A8926A'],
  nightPine: ['#0A0F0D', '#1C2621', '#1A3D28', '#1C2621', '#45D17A'],
  graphite: ['#121212', '#1E1E1E', '#2A3530', '#222222', '#6B9E78'],
  lightMint: ['#F4F9F6', '#FFFFFF', '#EAF5ED', '#F8FAF9', '#176B2C'],
  warmSoft: ['#F7F3EE', '#FFFDF9', '#EDE8DF', '#F5F0E8', '#7A6B4E'],
  softRose: ['#FBF4F5', '#FFFAFB', '#F5E8EB', '#F9F0F2', '#C46B7A'],
  midnight: ['#0D1117', '#161B22', '#1C2836', '#1A2128', '#58A6FF'],
};
function lum(hex) {const values = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return values[0]*0.2126+values[1]*0.7152+values[2]*0.0722;}
function ratio(first,second) {const a=lum(first),b=lum(second);return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);}
test('all palettes have WCAG AA readable muted labels on screen/card/chips/inputs', () => {
 for(const [name,backgrounds] of Object.entries(defaults)) {
  const palette = theme.match(new RegExp('  '+name+': \\{([\\s\\S]*?)\\n  \\},'))?.[1];
  assert.ok(palette,'Missing palette '+name);
  const muted = palette.match(/textMuted:\s*'(#[0-9A-Fa-f]{6})'/)?.[1];
  assert.ok(muted,'Missing muted label '+name);
  for(const background of backgrounds.slice(0,4)) assert.ok(ratio(muted,background)>=4.5,name+' muted contrast '+ratio(muted,background).toFixed(2)+' on '+background);
  const accent = backgrounds[4];
  const accessible = ratio('#FFFFFF',accent)>=4.5?'#FFFFFF':'#000000';
  assert.ok(ratio(accessible,accent)>=4.5,name+' action contrast');
 }
});
test('global control and messages use contrast-safe foreground', () => {
 assert.match(theme, /onAccent: accessibleTextOn\(p\.accent\)/);
 assert.match(messaging, /const onSent = accessibleTextOn\(p\.accent\)/);
 assert.match(messaging, /unreadBadgeText: accessibleTextOn\(p\.unreadBadge\)/);
 for(const path of ['src/lib/buklodThemePresentation.ts','src/components/BuklodContentReportSheet.tsx','src/components/BuklodCommunityCommentBubble.tsx','src/components/BuklodContentOverflowMenu.tsx','src/components/BuklodContentOverflowMenu.web.tsx','src/components/points/BuklodClaimRewardCard.tsx','src/components/points/BuklodPointsStage.tsx']) assert.match(read(path),/theme\.onAccent/,path);
});
test('screen margins and accessible touch-size share approved spacing tokens', () => {
 assert.match(visual,/space:\s*\{ screen: 12, section: 8, card: 10, inline: 8, tight: 4 \}/);
 assert.match(visual,/touch:\s*48/);
 assert.match(read('src/app/settings/index.tsx'),/paddingHorizontal: buklodVisual\.space\.screen/);
 assert.match(read('src/components/BuklodProfilePostCards.tsx'),/marginHorizontal:buklodVisual\.space\.screen/);
});
