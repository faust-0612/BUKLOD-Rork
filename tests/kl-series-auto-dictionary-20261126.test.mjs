import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mod=async s=>import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(s)));
const shelf=read('src/components/kabihasnang-ligaw/KlSeriesShelf.tsx');
const reader=read('src/components/kabihasnang-ligaw/KlReaderScreen.tsx');
const dynamic=read('src/components/kabihasnang-ligaw/KlDynamicLibrary.tsx');
const studio=read('src/components/kabihasnang-ligaw/KlPublishingStudio.tsx');
const hook=read('src/lib/kabihasnang-ligaw/useKlChapterDictionary.ts');
const sql=read('supabase/migrations/20261126080000_kl_series_and_dictionary_v1.sql');
const cron=read('supabase/migrations/20261126080001_kl_dictionary_scheduler_v1.sql');
const worker=read('supabase/functions/kl-dictionary-worker/index.ts');
const {parseKlSeries}=await mod(shelf.slice(shelf.indexOf('export type KlSeries ='),shelf.indexOf('export function useKlSeries')));
const {validateGlossary}=await mod('type Entry={name:string;kind:string;meaning:string;evidence:string};\n'+worker.slice(worker.indexOf('const word='),worker.indexOf('const safeEqual=')));
test('series catalog accepts only explicit, valid series metadata',()=>{
 const rows=parseKlSeries([
  {season_number:2,title:'Ang Mapa',published:false,cover_path:'2/book.jpg'},
  {season_number:1,title:'Ang Lupang Hindi Namamatay',published:true,cover_path:null},
  {season_number:3,title:'Wrong prefix',published:true,cover_path:'2/hidden.jpg'},
  {season_number:13,title:'Invalid',published:true},
  {season_number:2,title:'Duplicate',published:true},
  {season_number:4,title:'Missing status'}
 ]);
 assert.deepEqual(rows.map(r=>r.season_number),[1,2,3]);
 assert.equal(rows[1].published,false);
 assert.equal(rows[2].cover_path,null);
 assert.match(shelf,/rows\.filter\(row=>isAdmin\|\|row\.published\)/);
 assert.match(shelf,/p_publish:publish/);
 assert.match(shelf,/Confirm publish series/);
 assert.match(studio,/<KlSeriesAdmin/);
 assert.match(reader,/<KlSeriesShelf/);
 assert.match(reader,/<KlDynamicLibrary/);
});
test('staged SQL preserves private drafts, uploaded covers, and future-series release gates',()=>{
 assert.match(sql,/alter table public\.kl_series_v1 enable row level security/);
 assert.match(sql,/if p_admin and not private\.kl_is_active_admin_v1/);
 assert.match(sql,/where published or p_admin/);
 assert.match(sql,/Upload a cover first/);
 assert.match(sql,/Create the series in KL Studio first/);
 assert.match(sql,/Prepare validated reading quiz before release/);
 assert.match(sql,/new\.season_number>1/);
 assert.match(sql,/revoke all on private\.kl_dictionary_jobs_v1 from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.kl_dictionary_claim_v1\(\) to service_role/);
 assert.match(sql,/grant execute on function public\.kl_dictionary_finish_v1\(uuid,text,uuid,jsonb,text\) to service_role/);
 assert.match(sql,/e\.release_at<=now\(\)/);
 assert.match(sql,/\(e\.season_number,e\.episode_number\)<=\(v_season,v_episode\)/);
 assert.match(sql,/source_hash=md5\(private\.kl_dictionary_source_v1\(j\.episode_id\)\)/);
 assert.match(sql,/for update skip locked/);
 assert.match(sql,/interval '24 hours'/);
 assert.match(cron,/if not exists/);
 assert.match(cron,/KL_DICTIONARY_WORKER_KEY/);
});
test('worker accepts source-grounded distinct names; rejects fabricated excerpts and substring terms',()=>{
 const source='Sa ilalim ng puno, lumipad ang Ulapin, isang nilalang na may pakpak na tila ulap.';
 const row={name:'Ulapin',kind:'Nilalang',meaning:'Nilalang na may pakpak na tila ulap.',evidence:'lumipad ang Ulapin, isang nilalang na may pakpak na tila ulap.'};
 assert.deepEqual(validateGlossary({entries:[row,row]},source,[]),[row]);
 assert.deepEqual(validateGlossary({entries:[row]},source,['ULAPIN']),[]);
 assert.deepEqual(validateGlossary({entries:[{...row,name:'Lap'},{...row,evidence:'Hindi ito nasa kabanata.'},{...row,meaning:'x'}]},source,[]),[]);
 assert.deepEqual(validateGlossary(null,source,[]),[]);
});
test('reader does not generate glossary or drop existing chapter gates',()=>{
 assert.match(hook,/kl_dictionary_read_v1/);
 assert.match(hook,/remote\?\.id===episodeId && remote\?\.text===readableText/);
 assert.match(hook,/live=false/);
 assert.doesNotMatch(hook,/functions\.invoke/);
 assert.match(reader,/useKlChapterDictionary/);
 assert.match(dynamic,/useKlChapterDictionary/);
 assert.match(dynamic,/klReleaseBlockers\(target\)/);
 assert.match(dynamic,/kl_quiz_admin_context_v1/);
 assert.match(dynamic,/kl_reading_progress_v1/);
 assert.match(dynamic,/<KlReadingQuiz/);
 assert.match(reader,/warmBuklodAdOpportunity/);
});
