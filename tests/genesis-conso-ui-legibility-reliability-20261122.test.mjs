import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const editor = read('src/app/admin/system-announcement-boards.tsx');
const member = read('src/components/BuklodSystemAnnouncementBoard.tsx');
const data = read('src/lib/buklodSystemAnnouncementBoard.ts');
const map = read('src/app/buklod-map.tsx');
const world = read('src/features/season2/world/Season2DevelopmentMap.tsx');
const arena = read('src/app/games/empire-arena.tsx');
const combat = read('src/features/games/empire/ArenaCombatHud.tsx');
const theme = read('src/lib/buklodTheme.ts');

function contrast(a, b) {
  const luminance = (hex) => {
    assert.match(hex, /^#[0-9a-f]{6}$/i);
    const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = rgb.map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
    return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
  };
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}

function paletteValue(id, field) {
  const match = theme.match(new RegExp('  ' + id + ': \\{([\\s\\S]*?)\\n  \\},'));
  assert.ok(match, id + ' palette exists');
  const prop = match[1].match(new RegExp('\\b' + field + ": '(#[0-9A-Fa-f]{6})'"));
  assert.ok(prop, id + '.' + field + ' exists');
  return prop[1];
}

test('announcement editor uses semantic dark/light foregrounds and fully themed inputs', () => {
  assert.match(editor, /useThemedShared\(\)/);
  assert.match(editor, /useBuklodTheme\(\)/);
  assert.match(editor, /backgroundColor: theme.inputSurface/);
  assert.match(editor, /color: theme.textPrimary/);
  assert.match(editor, /placeholderTextColor=\{theme.textMuted\}/);
  assert.doesNotMatch(editor, /color: colors.text|style=\{shared.screen\}/);
  for (const id of ['nightPine', 'graphite', 'lightMint', 'cloudWhite']) {
    assert.ok(contrast(paletteValue(id, 'textPrimary'), paletteValue(id, 'inputSurface')) >= 4.5, id + ' editor input text');
    assert.ok(contrast(paletteValue(id, 'textPrimary'), paletteValue(id, 'surface')) >= 4.5, id + ' announcement message');
  }
});

test('announcement preview matches public and profile typography and keeps safe-area space', () => {
  assert.match(editor, /fontSize: isPublic \? 18 : 15/);
  assert.match(editor, /lineHeight: isPublic \? 24 : 22/);
  assert.match(member, /fontSize: slot === 'public_home' \? 18 : 15/);
  assert.match(member, /lineHeight: slot === 'public_home' \? 24 : 22/);
  assert.match(editor, /paddingTop: Math.max\(14, insets.top \+ 8\)/);
  assert.match(editor, /paddingBottom: Math.max\(20, insets.bottom \+ 18\)/);
  assert.match(editor, /Unsaved changes/);
  assert.match(editor, /SAVE HOME BOARD/);
  assert.match(editor, /SAVE PROFILE BOARD/);
  assert.match(member, /readableAccentOnSurface\(theme\)/);
});

test('public announcements only save after server acknowledgement, no private fake-local fallback', () => {
  assert.doesNotMatch(data, /AsyncStorage|saveLocalBoard|loadLocalBoards|isMissingTableError/);
  assert.match(data, /\.upsert\(payload, \{ onConflict: 'slot' \}\)/);
  assert.match(data, /\.select\('slot, message, is_active, updated_at'\)/);
  assert.match(data, /\.single\(\)/);
  assert.match(data, /if \(error\) throw error/);
  assert.match(data, /saved\.message !== cleanMessage/);
  assert.match(data, /saved\.is_active !== input\.is_active/);
  assert.match(editor, /const confirmed = await saveSystemAnnouncementBoard/);
  assert.match(editor, /Your draft is kept/);
});

test('announcement member display uses one focus fetch without blanking during refresh', () => {
  assert.equal((member.match(/useFocusEffect\(/g) || []).length, 1);
  assert.doesNotMatch(member, /useEffect\(/);
  assert.doesNotMatch(member, /setLoading\(true\)/);
  assert.match(member, /if \(active\) setLoading\(false\)/);
  assert.match(member, /if \(loadError\) return null/);
  assert.match(member, /minHeight: 44/);
});

test('Genesis Entry Map uses status-safe top content inset and World action targets', () => {
  assert.match(map, /paddingTop: Math.max\(6, insets.top \+ 6\)/);
  for (const pattern of [
    /previewToggle:\{minHeight:44/,
    /zoomButton:\{minWidth:44,minHeight:44/,
    /studioTab:\{flex:1,minHeight:44/,
    /trackButton:\{flex:1,minHeight:44/,
    /stage:\{flex:1,minHeight:44/,
    /returnText:\{color:'#FFEAC3',fontSize:11/,
    /mapBadgeText:\{color:'#FDEBC4',fontWeight:'800',fontSize:11/,
    /metricLabel:\{color:'#C4DBD1',fontSize:10/,
  ]) assert.match(world, pattern);
});

test('Arena control targets and in-battle HUD labels are no longer microscopic', () => {
  assert.match(arena, /back: \{ padding: 7, minWidth: 44, minHeight: 44/);
  assert.match(arena, /zoomButton: \{ minWidth: 44, minHeight: 44/);
  assert.match(arena, /controlLabel: \{ color: '#ffe7b5', fontSize: 10/);
  assert.match(arena, /teamCallButton: \{minWidth:73,minHeight:40/);
  assert.match(combat, /buttonLabel: \{position:'absolute',bottom:2,fontSize:10/);
  assert.match(combat, /utilityLabel: \{fontSize:10,bottom:0\}/);
  assert.match(combat, /joyLabel: \{position:'absolute',bottom:0,fontSize:10/);
});
