const fs=require('fs');
const path=require('path');

const file=path.resolve(
  'supabase/migrations/20260812033500_patch154v_d_bible_review_questions.sql'
);

let t=fs.readFileSync(file,'utf8');

const anchor=`create or replace function
public.reviewer_get_daily_bible_monitor_v3(
  p_assignment_id uuid
)`;

if(!t.includes(anchor)){
  throw new Error(
    'V3 function anchor not found'
  );
}

if(
  !t.includes(
    'drop function if exists public.reviewer_get_daily_bible_monitor_v3(uuid);'
  )
){
  t=t.replace(
    anchor,
`drop function if exists
public.reviewer_get_daily_bible_monitor_v3(uuid);

${anchor}`
  );
}

fs.writeFileSync(
  file,
  t,
  'utf8'
);

console.log('');
console.log('PATCH 154V-D DB RETURN-TYPE FIX WRITTEN');
console.log('✓ old V3 RPC will be dropped first');
console.log('✓ new V3 return columns can now be recreated');
console.log('✓ reviewer app code untouched');
console.log('');

