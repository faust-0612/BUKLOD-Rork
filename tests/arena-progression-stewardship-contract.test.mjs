import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../apps/buklod-empire-unity/',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const sql=read('Tools/arena-progression-server-candidate.sql');
test('arena candidate isolates ministry balances and requires private server authority',()=>{
  assert.doesNotMatch(sql,/insert into public\.buklod_points_ledger|update public\.buklod_user_points_balances|grant execute/i);
  assert.match(sql,/revoke all on all functions in schema empire_rewards from public,anon,authenticated/);
  assert.match(sql,/state='completed' for share/);
  assert.match(sql,/primary key\(match_id,user_id\)/);
  assert.match(sql,/old\.evidence is distinct from facts/);
  assert.match(sql,/count\(distinct hero_id\).*<>10/);
});
test('BP stewardship caps and penalties remain isolated',()=>{
  assert.match(sql,/n<5/);
  assert.match(sql,/30-earned/);
  assert.match(sql,/20-penalty_today/);
  assert.match(sql,/bp_amount:=-least\(bal/);
  assert.match(sql,/conduct='clean' and eligible/);
  assert.match(sql,/bp bigint not null default 0 check\(bp>=0\)/);
  assert.match(sql,/100\*n/);
});
test('canonical character XP and milestone contracts, thirteen identities',()=>{
  const stones=JSON.parse(read('Assets/Resources/SacredStones.json')).stones;
  assert.equal(new Set(stones.map(x=>x.heroId)).size,13);
  assert.match(sql,/buklod_character_switch_v3/);
  assert.match(sql,/private\.buklod_character_progress_v3/);
  assert.match(sql,/credit_character\(u,h,xp_amount\+bonus_xp\)/);
  assert.match(sql,/\(10,100\),\(25,250\),\(50,500\)/);
  assert.match(sql,/mission:'\|\|tier/);
  assert.match(read('Assets/Scripts/BattleHud.cs'),/ArenaProgression.TrainingResult\(true\)/);
  assert.match(read('Assets/Scripts/ArenaProgression.cs'),/0 BP \/ 0 permanent XP/);
});

test('graded policy and role weights',()=>{
  const profiles=[...sql.matchAll(/when '([a-z]+)' then array\[([\d,]+)\]/g)];
  assert.equal(profiles.length,13);
  for(const [,hero,values] of profiles){const w=values.split(',').map(Number);assert.equal(w.length,8,hero);assert.equal(w.reduce((a,b)=>a+b,0),100,hero);}
  assert.match(sql,/least\(raw_xp,300\)/);
  assert.match(sql,/covered<60/);
  assert.match(sql,/grade_bp\(overall\)/);
  assert.match(sql,/bp_raw:=3\+case when outcome='win' then 2 else 0 end/);
  assert.match(sql,/return old\.breakdown\|\|/);
  assert.doesNotMatch(sql,/^end \$;$/m);
  assert.doesNotMatch(sql,/as \$$/m);
  assert.equal((sql.match(/\$\$/g)||[]).length,(sql.match(/^create function/gm)||[]).length*2);
  assert.equal((sql.match(/^commit;$/gm)||[]).length,1);
  assert.match(sql,/raise exception 'Invalid virtue evidence'/);
  assert.match(sql,/virtue:=\(facts->>'virtue'\)::integer/);
  assert.match(sql,/normalize_metric\(v\)/);
  assert.match(sql,/70\*impact\+20\*efficiency\+10\*impact\*difficulty\/100/);
  assert.match(sql,/if effective=0 then return 0/);
  assert.match(sql,/'best_category',best_key,'next_category',next_key/);
});
