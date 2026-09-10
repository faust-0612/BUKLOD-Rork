-- BUKLOD IGPAT R7 — HARDENING + ARENA LIFECYCLE
-- Apply AFTER BUKLOD_IGPAT_R7_FULL_COMPLETION.sql.

-- Replace the permissive/tautological update policy with participant-only mutation.
drop policy if exists igpat_arena_update_participant on public.igpat_arena_challenges;
create policy igpat_arena_update_participant
on public.igpat_arena_challenges
for update
to authenticated
using (
  creator_user_id = auth.uid()
  or opponent_user_id = auth.uid()
)
with check (
  creator_user_id = auth.uid()
  or opponent_user_id = auth.uid()
);

create table if not exists public.igpat_arena_results (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.igpat_arena_challenges(id) on delete cascade,
  submitted_by uuid not null default auth.uid(),
  post_id uuid null,
  completion_note text not null default '' check (char_length(completion_note) <= 800),
  verified boolean not null default false,
  respect_received integer not null default 0 check (respect_received >= 0),
  created_at timestamptz not null default now(),
  unique(challenge_id, submitted_by)
);
create index if not exists igpat_arena_results_challenge_idx on public.igpat_arena_results(challenge_id, created_at desc);
alter table public.igpat_arena_results enable row level security;

do $$ begin
  create policy igpat_arena_results_read_auth on public.igpat_arena_results for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy igpat_arena_results_insert_own on public.igpat_arena_results for insert to authenticated with check (submitted_by=auth.uid());
exception when duplicate_object then null; end $$;

create or replace function public.igpat_accept_arena_challenge_v1(p_challenge_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.igpat_arena_challenges
  set opponent_user_id=coalesce(opponent_user_id,auth.uid()), status='ACCEPTED'
  where id=p_challenge_id
    and status='OPEN'
    and creator_user_id<>auth.uid()
    and (opponent_user_id is null or opponent_user_id=auth.uid());
  if not found then raise exception 'Challenge is not available to accept'; end if;
end; $$;

create or replace function public.igpat_submit_arena_result_v1(
  p_challenge_id uuid,
  p_post_id uuid default null,
  p_completion_note text default ''
) returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.igpat_arena_challenges c
    where c.id=p_challenge_id
      and (c.creator_user_id=auth.uid() or c.opponent_user_id=auth.uid())
      and c.status in ('ACCEPTED','ACTIVE')
  ) then raise exception 'You are not an active participant'; end if;

  insert into public.igpat_arena_results(challenge_id,submitted_by,post_id,completion_note)
  values(p_challenge_id,auth.uid(),p_post_id,left(coalesce(p_completion_note,''),800))
  on conflict(challenge_id,submitted_by) do update
    set post_id=excluded.post_id, completion_note=excluded.completion_note
  returning id into v_id;

  update public.igpat_arena_challenges set status='ACTIVE' where id=p_challenge_id and status='ACCEPTED';
  return v_id;
end; $$;

create or replace function public.igpat_complete_arena_challenge_v1(
  p_challenge_id uuid,
  p_winner_user_id uuid default null
) returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.igpat_arena_challenges c
  set status='COMPLETED', winner_user_id=p_winner_user_id, completed_at=now()
  where c.id=p_challenge_id
    and c.creator_user_id=auth.uid()
    and c.status in ('ACCEPTED','ACTIVE');
  if not found then raise exception 'Only the challenge creator can complete this active challenge'; end if;
end; $$;

create or replace function public.igpat_rematch_arena_challenge_v1(p_challenge_id uuid)
returns uuid language plpgsql security invoker set search_path=public as $$
declare src public.igpat_arena_challenges%rowtype; v_id uuid; v_opponent uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into src from public.igpat_arena_challenges where id=p_challenge_id and status='COMPLETED';
  if src.id is null or (src.creator_user_id<>auth.uid() and src.opponent_user_id is distinct from auth.uid()) then
    raise exception 'Rematch unavailable';
  end if;
  v_opponent := case when src.creator_user_id=auth.uid() then src.opponent_user_id else src.creator_user_id end;
  insert into public.igpat_arena_challenges(creator_user_id,mode,post_id,opponent_user_id,squad_id,title,status)
  values(auth.uid(),src.mode,null,v_opponent,src.squad_id,concat('REMATCH · ',coalesce(src.title,src.mode)),'OPEN') returning id into v_id;
  return v_id;
end; $$;

create or replace function public.igpat_give_arena_respect_v1(p_challenge_id uuid, p_result_user_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_result_user_id=auth.uid() then raise exception 'You cannot give Respect to yourself'; end if;
  update public.igpat_arena_results r
  set respect_received=respect_received+1
  where r.challenge_id=p_challenge_id and r.submitted_by=p_result_user_id;
  if not found then raise exception 'Arena result not found'; end if;
end; $$;

-- IMPORTANT: Arena has no separate currency and this migration does not award points.
-- Any future reward must go through the canonical BUKLOD Points ledger contract.

grant execute on function public.igpat_accept_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_submit_arena_result_v1(uuid,uuid,text) to authenticated;
grant execute on function public.igpat_complete_arena_challenge_v1(uuid,uuid) to authenticated;
grant execute on function public.igpat_rematch_arena_challenge_v1(uuid) to authenticated;
grant execute on function public.igpat_give_arena_respect_v1(uuid,uuid) to authenticated;
