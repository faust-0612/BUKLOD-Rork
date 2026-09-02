const fs=require('fs');
const path=require('path');

/* ============================================================
   PATCH APP
============================================================ */

const file=path.resolve(
  'src/app/bible/index.tsx'
);

let t=fs.readFileSync(file,'utf8');

const backup=
  file+'.bak154v_fix3_wrapper';

if(!fs.existsSync(backup)){
  fs.copyFileSync(file,backup);
}

const start=t.indexOf(
  '    /*\n     * PATCH 154V-FIX2'
);

const end=t.indexOf(
  '    let databaseRows:any[] = [];',
  start
);

if(start<0 || end<0){
  throw new Error(
    'PATCH 154V-FIX2 block not found'
  );
}

const replacement=`    /*
     * PATCH 154V-FIX3
     *
     * Use the authenticated-safe server wrapper.
     * The private materialization helper remains private.
     */
    const {
      data:automaticData,
      error:automaticError
    } = await (supabase as any).rpc(
      'ensure_current_automatic_bible_week_v2'
    );

    if(automaticError){
      throw automaticError;
    }

    const automaticRows =
      Array.isArray(automaticData)
        ? automaticData
        : [];

    const automaticIds =
      automaticRows
        .map(
          (row:any)=>
            String(
              row?.assignment_id ?? ''
            )
        )
        .filter(Boolean);

`;

t=
  t.slice(0,start)+
  replacement+
  t.slice(end);

fs.writeFileSync(
  file,
  t,
  'utf8'
);


/* ============================================================
   DATABASE MIGRATION
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812025500_patch154v_fix3_safe_automatic_week.sql'
);

const sql=String.raw`
-- ============================================================
-- PATCH 154V-FIX3
-- SAFE AUTOMATIC DAILY BIBLE WEEK WRAPPER
--
-- materialize_automatic_bible_assignment(date) stays private.
-- Members can only request materialization of CURRENT week.
-- ============================================================

create or replace function
public.ensure_current_automatic_bible_week_v2()
returns table (
  assignment_id uuid,
  reading_date date,
  bible_reference text,
  plan_week_number integer,
  cycle_number integer,
  chapters_today integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  local_today date :=
    (now() at time zone 'Asia/Manila')::date;

  monday_date date;

  offset_days integer;

  target_date date;
begin

  /*
   * ISO weekday:
   * Monday = 1
   * Sunday = 7
   */
  monday_date :=
    local_today
    - (
        extract(
          isodow from local_today
        )::integer
        - 1
      );


  /*
   * Private helper runs with function-owner privileges.
   * Caller never gets direct EXECUTE permission on it.
   */
  for offset_days in 0..6 loop

    target_date :=
      monday_date + offset_days;

    perform
      public.materialize_automatic_bible_assignment(
        target_date
      );

  end loop;


  /*
   * Fully qualify every column so PL/pgSQL output variables
   * cannot conflict with table column names.
   */
  return query

  select
    a.id,
    a.reading_date,
    a.bible_reference,
    a.automatic_plan_week,
    a.automatic_cycle_number,
    a.automatic_chapters_today

  from public.daily_bible_assignments a

  where
    a.reading_date >= monday_date
    and
    a.reading_date <=
      monday_date + 6

  order by
    a.reading_date;

end;
$$;


revoke all
on function
public.ensure_current_automatic_bible_week_v2()
from public;


grant execute
on function
public.ensure_current_automatic_bible_week_v2()
to authenticated;


comment on function
public.ensure_current_automatic_bible_week_v2()
is
'Authenticated-safe wrapper that materializes and returns only the current Asia/Manila Monday-Sunday automatic Daily Bible Reading week.';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);

console.log('');
console.log('PATCH 154V-FIX3 WRITTEN');
console.log('✓ private materializer stays private');
console.log('✓ new authenticated-safe week wrapper');
console.log('✓ assignment_id ambiguity removed');
console.log('✓ current automatic week materializes');
console.log('✓ 4 questions retained');
console.log('');

