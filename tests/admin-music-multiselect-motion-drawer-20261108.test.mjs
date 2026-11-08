import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const admin=read('src/app/admin/music-library.tsx');
const service=read('src/lib/buklodMusicAdmin.ts');
const wall=read('src/app/(tabs)/buklod.tsx');
const creative=read('src/lib/buklodPostCreatives.ts');

test('System Admin music picker accepts multiple files with bounded selection and per-item metadata',()=>{
  assert.match(admin,/DocumentPicker\.getDocumentAsync\(\{/);
  assert.match(admin,/multiple:true/);
  assert.match(admin,/MAX_MUSIC_FILES_PER_BATCH=20/);
  assert.match(admin,/result\.assets/);
  assert.match(admin,/for\(const asset of result\.assets\)/);
  assert.match(admin,/validateBuklodMusicFile\(asset\.name,sizeOf\(asset\)\)/);
  assert.match(admin,/signatures\.has\(signature\)/);
  assert.match(admin,/item\.title/);
  assert.match(admin,/item\.artist/);
  assert.match(admin,/updateDraft\(item\.key,'title'/);
  assert.match(admin,/updateDraft\(item\.key,'artist'/);
  assert.match(admin,/Remove selected/);
  assert.match(admin,/Upload and publish/);
});

test('Batch publishing is sequential, avoids duplicate submissions, preserves failed files for retry',()=>{
  assert.match(admin,/if\(!picked\.length\|\|pickerBusy\|\|busy\|\|uploadInFlight\.current\)return/);
  assert.match(admin,/uploadInFlight\.current=true/);
  assert.match(admin,/for\(let i=0;i<queue\.length;i\+\+\)/);
  assert.match(admin,/await uploadBuklodAdminMusic\(\{/);
  assert.match(admin,/setPicked\(current=>current\.filter\(row=>row\.key!==item\.key\)\)/);
  assert.match(admin,/error:message/);
  assert.match(admin,/Failed files remain below for retry/);
  assert.match(admin,/if\(published\)await refresh\(\)/);
  assert.match(admin,/finally\{uploadInFlight\.current=false;setBusy\(false\);\}/);
  assert.doesNotMatch(admin,/Promise\.all\([^;]*uploadBuklodAdminMusic/s);
});

test('Existing per-file admin RLS, safe uploads and rollback remain enforced',()=>{
  assert.match(service,/await assertSystemAdmin\(\)/);
  assert.match(service,/BUKLOD_MUSIC_ADMIN_LIMIT_BYTES=25\*1024\*1024/);
  assert.match(service,/\.upload\(path,bytes/);
  assert.match(service,/upsert:false/);
  assert.match(service,/\.remove\(\[path\]\)/);
  assert.match(service,/new File\(input\.asset\.uri\)\.arrayBuffer\(\)/);
  assert.match(admin,/pendingDeleteId===track\.id/);
});

test('Wall composer defaults to collapsed grouped motion drawer and preserves chosen preset',()=>{
  assert.match(wall,/const \[composerMotionDrawerOpen,setComposerMotionDrawerOpen\]=useState\(false\)/);
  assert.match(wall,/accessibilityLabel="Photo animation and ambiance drawer"/);
  assert.match(wall,/accessibilityState=\{\{expanded:composerMotionDrawerOpen\}\}/);
  assert.match(wall,/onPress=\{\(\)=>setComposerMotionDrawerOpen\(current=>!current\)\}/);
  assert.match(wall,/\{composerMotionDrawerOpen&&\(/);
  assert.match(wall,/BUKLOD_MOTION_DRAWER_GROUPS\.map\(group/);
  assert.match(wall,/group\.items\.map\(preset/);
  assert.match(wall,/onPress=\{\(\)=>setComposerMotionPreset\(preset\)\}/);
  assert.match(wall,/Selected: '\+BUKLOD_POST_MOTION_LABELS\[composerMotionPreset\]/);
  assert.match(wall,/setComposerMotionDrawerOpen\(false\)/);
  assert.match(wall,/setComposerMotionPreset\('none'\)/);
  assert.match(wall,/BUKLOD_POST_MOTION_LABELS\[preset\]/);
  assert.match(wall,/saveBuklodPostCreative/);
  assert.match(creative,/normalizeBuklodMotion/);
});

test('Motion/weather/atmosphere groups retain all existing supported effect keys once',()=>{
  const presetMatch=creative.match(/BUKLOD_POST_MOTION_PRESETS = \[([\s\S]*?)\] as const;/);
  assert.ok(presetMatch);
  const all=[...presetMatch[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
  const groups=[
    ['none','zoom','pan','float','fade'],
    ['rain','storm','snow','mist','petals','autumn'],
    ['sparkles','fireflies','sunrays','dust','bokeh','stars','underwater'],
  ];
  assert.deepEqual([...new Set(groups.flat())].sort(),[...all].sort());
  assert.equal(groups.flat().length,all.length);
  for(const [label] of [['Animation'],['Weather & nature'],['Light & atmosphere']])
    assert.ok(wall.includes(label));
});
