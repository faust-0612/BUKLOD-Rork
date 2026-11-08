import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const read=path=>readFileSync(path,'utf8');
const migration=read('supabase/migrations/20261108043000_buklod_music_admin_and_ambience_v1.sql');
const library=read('src/lib/buklodPostCreatives.ts');
const admin=read('src/lib/buklodMusicAdmin.ts');
const page=read('src/app/admin/music-library.tsx');
const dashboard=read('src/app/admin/index.tsx');
const wall=read('src/app/(tabs)/buklod.tsx');
const motion=read('src/components/BuklodPostMotion.tsx');
const cache=read('src/lib/buklodPerformanceFetch.ts');

test('only System Admin can write private music objects or catalog records',()=>{
  for(const operation of ['insert','update','delete']) {
    assert.match(migration,new RegExp('buklod_music_admin_'+operation));
  }
  assert.match(migration,/bucket_id='buklod-music-library'/);
  assert.match(migration,/for insert to authenticated/);
  assert.match(migration,/for delete to authenticated/);
  assert.match(migration,/public\.is_system_admin\(\)/);
  assert.match(migration,/buklod_music_private_active_read/);
  assert.match(migration,/m\.is_active = true/);
  assert.doesNotMatch(migration,/to anon\s+with check|to public\s+with check/i);
  assert.match(admin,/supabase\.rpc\('is_system_admin'\)/);
  assert.doesNotMatch(admin,/service_role|SUPABASE_SERVICE_KEY|Bearer\s/);
});
test('new songs publish after successful private upload; cleanup on partial failure',()=>{
  assert.match(admin,/Crypto\.randomUUID\(\)/);
  assert.match(admin,/\.upload\(path,bytes/);
  assert.match(admin,/upsert:false/);
  assert.match(admin,/\.insert\(\{title,artist/);
  assert.match(admin,/\.remove\(\[path\]\)/);
  assert.match(admin,/file\.arrayBuffer\(\)/);
  assert.match(admin,/new File\(input\.asset\.uri\)\.arrayBuffer\(\)/);
  assert.match(admin,/BUKLOD_MUSIC_ADMIN_LIMIT_BYTES=25\*1024\*1024/);
  assert.match(cache,/buklod_music_library: 0/);
  assert.match(library,/\.eq\('is_active', true\)/);
});
test('admin can delete with confirmation and retry safely without touching posts',()=>{
  assert.match(dashboard,/path="\/admin\/music-library"/);
  assert.match(page,/<AdminGate>/);
  assert.match(page,/DocumentPicker\.getDocumentAsync/);
  assert.match(page,/pendingDeleteId===track\.id/);
  assert.match(page,/deleteBuklodAdminMusic/);
  assert.match(admin,/\.update\(\{is_active:false\}\)/);
  assert.match(admin,/\.delete\(\)\.eq\('id',track\.id\)/);
  assert.match(migration,/alter table public\.buklod_post_creatives/);
  assert.doesNotMatch(migration,/delete\s+from\s+public\.community_posts/i);
});
test('all optional photo ambience presets share DB constraint and client normalization',()=>{
  const names=['rain','storm','snow','mist','sparkles','fireflies','petals',
    'sunrays','dust','bokeh','stars','autumn','underwater'];
  for(const name of names) {
    assert.ok(library.includes("'"+name+"'"),name+' missing in library');
    assert.ok(migration.includes("'"+name+"'"),name+' missing in DB');
    assert.ok(motion.includes("'"+name+"'"),name+' missing in renderer');
  }
  assert.match(library,/normalizeBuklodMotion/);
  assert.match(wall,/BUKLOD_POST_MOTION_LABELS\[preset\]/);
  assert.match(wall,/saveBuklodPostCreative/);
  assert.match(wall,/active=\{wallScreenFocused&&visibleCreativePostIds\.includes/);
});
test('effects auto-render only on visible posts and respect reduced-motion and app background',()=>{
  assert.match(motion,/active=true/);
  assert.match(motion,/AppState\.addEventListener/);
  assert.match(motion,/isReduceMotionEnabled/);
  assert.match(motion,/running=active&&appActive&&!reduceMotion/);
  assert.match(motion,/Animated\.loop/);
  assert.match(motion,/Animated\.sequence/);
  assert.match(motion,/canvasHeight\+80/);
  assert.doesNotMatch(motion,/Play post animation|Pause post animation/);
  assert.match(wall,/onCommunityWallViewableItemsChanged/);
  assert.match(wall,/visibleCreativePostIds/);
  assert.match(wall,/communityCreativeExtraData/);
  assert.match(wall,/communityViewabilityListener\.current\(event\)/);
  assert.doesNotMatch(motion,/expo-audio|ffmpeg|VideoView/);
  assert.doesNotMatch(wall,/useAudioPlayer\(null/);
});
