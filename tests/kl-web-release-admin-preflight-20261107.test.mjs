import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const read = p => readFileSync(new URL('../'+p,import.meta.url),'utf8');
const policy = await import('data:text/javascript,'+encodeURIComponent(
  stripTypeScriptTypes(read('src/lib/kabihasnang-ligaw/releasePreflight.ts'))));
const row = (overrides={}) => ({
  id:'aa000001-0000-4000-8000-000000000003',
  season_number:1,episode_number:2,status:'approved',
  approved_at:'2026-11-06T08:00:00.000Z',
  release_at:null,preview_ready:true,has_manuscript:true,...overrides,
});

test('use exact database ID instead of synthetic episode-number UUID', () => {
  const random = row({id:'8e71434f-018c-4881-a8bd-89e4a0395321',episode_number:4});
  const rows = policy.parseKlAdminChapters([row(),random]);
  assert.equal(policy.findKlAdminChapter(rows,1,4)?.id, random.id);
  assert.notEqual(policy.findKlAdminChapter(rows,1,4)?.id,
    'aa000001-0000-4000-8000-000000000005');
  assert.equal(policy.findKlAdminChapter(rows,1,5),null);
  assert.equal(policy.parseKlAdminChapters([{...random,id:'not-a-uuid'}]).length,0);
});

test('release preflight blocks missing, unapproved, unprepared and already-live chapters', () => {
  assert.equal(policy.klReleaseBlockers(null).length,1);
  const draft=row({status:'draft',approved_at:null,release_at:null,
    preview_ready:false,has_manuscript:false});
  assert.equal(policy.klReleaseBlockers(draft).length,3);
  const now=Date.parse('2026-11-07T01:00:00.000Z');
  assert.deepEqual(policy.klReleaseBlockers(row(),now),[]);
  const released=row({release_at:'2026-11-06T08:00:00.000Z'});
  assert.equal(policy.isKlChapterReleased(released,now),true);
  assert.match(policy.klReleaseBlockers(released,now)[0],/already been released/);
  assert.equal(policy.isKlChapterReleased(row({release_at:'2026-11-10T08:00:00.000Z'}),now),false);
});

test('KL admin action uses exact server-provided chapter ID, with verified release result', () => {
  const source=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
  assert.match(source,/supabase\.rpc\(KL_RPC\.adminList\)/);
  assert.match(source,/parseKlAdminChapters/);
  assert.match(source,/findKlAdminChapter\(freshRows, 1, targetEpisode\.episodeNumber\)/);
  assert.match(source,/episodeId: serverChapter\.id/);
  assert.match(source,/if \(result\?\.ok !== true\)/);
  assert.match(source,/isKlChapterReleased\(updatedChapter/);
  assert.match(source,/adminActionLockRef\.current/);
  assert.match(source,/klReleaseBlockers\(serverChapter/);
  const start=source.indexOf('{EPISODES.map((episode) => {');
  const end=source.indexOf('</ScrollView>', start);
  const chapter=source.slice(start,end);
  assert.match(chapter,/<View\s+key=\{episode\.id\}[\s\S]*?<Pressable[\s\S]*?onPress=\{\(\) => openReadable\(episode\.id\)\}/);
  assert.match(chapter,/Confirm Release Now/);
  assert.match(chapter,/Release Now/);
  assert.match(chapter,/Refresh status/);
});


test('published random-ID chapters stay readable with real UUID for reading and rewards', () => {
  const source=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
  assert.match(source,/const databaseIdForEpisode = \(episodeNumber: number\)/);
  assert.match(source,/releasedChapters\.find\(chapter =>[\s\S]*?chapter\.episode_number === episodeNumber\)\?\.id/);
  assert.match(source,/findKlAdminChapter\(visibleAdminRows, 1, episodeNumber\)\?\.id/);
  assert.match(source,/const dbId = databaseIdForEpisode\(episode\.episodeNumber\)/);
  assert.match(source,/const selectedDbId = selected \? databaseIdForEpisode\(selected\.episodeNumber\)/);
  assert.match(source,/<KlReadingQuiz key=\{selectedDbId/);
  assert.match(source,/releasedNumbers\.has\(selected\.episodeNumber\)/);
  assert.match(source,/releasedNumbers\.has\(fromCatalog\.episodeNumber\)/);
});
