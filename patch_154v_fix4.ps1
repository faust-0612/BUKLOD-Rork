$path = "supabase\migrations\20260812030500_patch154v_fix4_schema_cache.sql"

$sql = @"
-- PATCH 154V-FIX4
-- Recreate safe automatic Bible week RPC
-- + force PostgREST schema reload.

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
as `$`$
declare
  v_today date :=
    (now() at time zone 'Asia/Manila')::date;

  v_monday date;

  v_day integer;

  v_target_date date;
begin

  v_monday :=
    v_today -
    (
      extract(isodow from v_today)::integer - 1
    );

  for v_day in 0..6 loop

    v_target_date :=
      v_monday + v_day;

    perform
      public.materialize_automatic_bible_assignment(
        v_target_date
      );

  end loop;

  return query
  select
    a.id,
    a.reading_date,
    a.bible_reference,
    a.automatic_plan_week,
    a.automatic_cycle_number,
    a.automatic_chapters_today
  from public.daily_bible_assignments as a
  where
    a.reading_date >= v_monday
    and a.reading_date <= v_monday + 6
  order by
    a.reading_date;

end;
`$`$;


revoke all
on function
public.ensure_current_automatic_bible_week_v2()
from public;

grant execute
on function
public.ensure_current_automatic_bible_week_v2()
to authenticated;


/* Force Supabase/PostgREST to refresh RPC schema */
notify pgrst, 'reload schema';

"@

[IO.File]::WriteAllText(
  (Join-Path (Get-Location) $path),
  $sql,
  [Text.UTF8Encoding]::new($false)
)

Write-Host ""
Write-Host "PATCH 154V-FIX4 MIGRATION WRITTEN" -ForegroundColor Green
Write-Host "✓ V2 RPC recreated" -ForegroundColor Green
Write-Host "✓ schema cache reload included" -ForegroundColor Green
Write-Host ""
