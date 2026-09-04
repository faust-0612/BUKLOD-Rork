create table if not exists public.buklod_education_classroom_reactions (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.buklod_education_classrooms(id) on delete cascade,
  target_type text not null check (target_type in ('POST','COMMENT')),
  target_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_key text not null check (reaction_key in ('LIKE','LOVE','APPLAUSE','INSIGHTFUL','AMEN','QUESTION')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (classroom_id, target_type, target_id, user_id)
);

create index if not exists idx_classroom_reactions_target
  on public.buklod_education_classroom_reactions(classroom_id, target_type, target_id);

alter table public.buklod_education_classroom_reactions enable row level security;

create or replace function public.buklod_classroom_toggle_reaction_v1(
  p_classroom_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reaction_key text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_target_type text := upper(btrim(coalesce(p_target_type,'')));
  v_reaction text := upper(btrim(coalesce(p_reaction_key,'')));
  v_existing text;
begin
  if v_uid is null then raise exception 'Authentication required.'; end if;
  if not (
    public.buklod_education_is_faculty_owner_v2(p_classroom_id)
    or public.buklod_education_is_enrolled_for_classroom_v2(p_classroom_id)
  ) then
    raise exception 'Classroom access required.';
  end if;
  if v_target_type not in ('POST','COMMENT') then raise exception 'Invalid reaction target.'; end if;
  if v_reaction not in ('LIKE','LOVE','APPLAUSE','INSIGHTFUL','AMEN','QUESTION') then
    raise exception 'Invalid reaction.';
  end if;

  if v_target_type = 'POST' and not exists (
    select 1 from public.buklod_education_classroom_posts p
    where p.id = p_target_id and p.classroom_id = p_classroom_id and p.deleted_at is null
  ) then raise exception 'Post not found.'; end if;

  if v_target_type = 'COMMENT' and not exists (
    select 1 from public.buklod_education_classroom_comments c
    where c.id = p_target_id and c.classroom_id = p_classroom_id and c.deleted_at is null
  ) then raise exception 'Comment not found.'; end if;

  select r.reaction_key into v_existing
  from public.buklod_education_classroom_reactions r
  where r.classroom_id = p_classroom_id
    and r.target_type = v_target_type
    and r.target_id = p_target_id
    and r.user_id = v_uid;

  if v_existing = v_reaction then
    delete from public.buklod_education_classroom_reactions
    where classroom_id = p_classroom_id
      and target_type = v_target_type
      and target_id = p_target_id
      and user_id = v_uid;
    return 'REMOVED';
  end if;

  insert into public.buklod_education_classroom_reactions(
    classroom_id,target_type,target_id,user_id,reaction_key,created_at,updated_at
  ) values (
    p_classroom_id,v_target_type,p_target_id,v_uid,v_reaction,now(),now()
  )
  on conflict (classroom_id,target_type,target_id,user_id)
  do update set reaction_key = excluded.reaction_key, updated_at = now();

  return case when v_existing is null then 'ADDED' else 'CHANGED' end;
end;
$$;

create or replace function public.buklod_classroom_reaction_summary_v1(p_classroom_id uuid)
returns table(
  target_type text,
  target_id uuid,
  reaction_key text,
  reaction_count bigint,
  user_reacted boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select r.target_type,
         r.target_id,
         r.reaction_key,
         count(*)::bigint,
         bool_or(r.user_id = auth.uid())
  from public.buklod_education_classroom_reactions r
  where r.classroom_id = p_classroom_id
    and (
      public.buklod_education_is_faculty_owner_v2(p_classroom_id)
      or public.buklod_education_is_enrolled_for_classroom_v2(p_classroom_id)
    )
  group by r.target_type,r.target_id,r.reaction_key
  order by r.target_type,r.target_id,r.reaction_key;
$$;

revoke all on function public.buklod_classroom_toggle_reaction_v1(uuid,text,uuid,text) from public;
grant execute on function public.buklod_classroom_toggle_reaction_v1(uuid,text,uuid,text) to authenticated;
revoke all on function public.buklod_classroom_reaction_summary_v1(uuid) from public;
grant execute on function public.buklod_classroom_reaction_summary_v1(uuid) to authenticated;
