-- BUKLOD R2 verified challenge and milestone awarding (non-destructive).
-- New R2 categories remain inactive until a trusted System Admin activates them.
-- This endpoint never trusts client-provided point amounts.
insert into public.buklod_point_rules
(activity_type,label,base_points,max_points_per_event,daily_cap_points,weekly_cap_points,is_active,notes)
values ('r2_verified_challenge','Verified R2 challenge',10,40,80,300,false,
  'System Admin evidence-required challenge; ×1/1.5/2.5/4 with event/daily/weekly caps')
on conflict (activity_type) do nothing;

create table if not exists public.buklod_r2_accomplishment_reviews (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id),
 activity_type text not null,
 milestone_key text not null,
 difficulty text not null,
 evidence_note text not null,
 points_awarded integer not null check(points_awarded between 1 and 500),
 approved_by uuid not null references public.profiles(id),
 ledger_id uuid not null unique references public.buklod_points_ledger(id),
 approved_at timestamptz not null default now(),
 unique(user_id,activity_type,milestone_key),
 constraint buklod_r2_difficulty_check check (difficulty in ('easy','medium','hard','expert'))
);
create index if not exists buklod_r2_reviews_user_idx
on public.buklod_r2_accomplishment_reviews(user_id,approved_at desc);
alter table public.buklod_r2_accomplishment_reviews enable row level security;
revoke all on public.buklod_r2_accomplishment_reviews from public,anon,authenticated;
-- Reviews are audit records. Expose only a vetted RPC if a member-facing history is needed.

create or replace function public.admin_award_buklod_r2_accomplishment_v1(
 p_user_id uuid,
 p_activity_type text,
 p_milestone_key text,
 p_evidence_note text,
 p_difficulty text default 'easy'
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
 actor uuid := (select auth.uid());
 kind text := lower(trim(coalesce(p_activity_type,'')));
 proof_key text := lower(trim(coalesce(p_milestone_key,'')));
 proof text := trim(coalesce(p_evidence_note,''));
 level text := lower(trim(coalesce(p_difficulty,'')));
 factor numeric;
 rule_rec record;
 amount integer;
 existing_id uuid;
 new_ledger_id uuid;
 canonical_source text;
begin
 if actor is null or not public.is_system_admin() then
   raise exception 'System Admin required' using errcode='42501';
 end if;
 if p_user_id is null then raise exception 'Member required'; end if;
 if kind not in (
   'r2_verified_challenge',
   'verified_volunteer_service','verified_mentoring_session',
   'ministry_major_milestone','game_first_qualified',
   'game_medium_win','game_hard_win','game_advanced_perfect',
   'game_puzzle_series','game_expert_campaign','game_tournament_champion',
   'achievement_bible_scholar','achievement_community_builder',
   'achievement_faithful_mentor','achievement_kingdom_champion'
 ) then raise exception 'R2 activity is not eligible for manual award'; end if;
 if length(proof_key) not between 8 and 120 or proof_key !~ '^[a-z0-9][a-z0-9:_-]+$' then
   raise exception 'Valid stable milestone key required';
 end if;
 if length(proof) < 20 or length(proof) > 2000 then
   raise exception 'Evidence note must be 20-2000 characters';
 end if;
 if level not in ('easy','medium','hard','expert') then
   raise exception 'Invalid challenge difficulty';
 end if;
 if kind <> 'r2_verified_challenge' and level <> 'easy' then
   raise exception 'Difficulty applies only to verified challenges';
 end if;
 -- One-time achievements cannot be claimed again under a different key.
 if kind like 'achievement_%' then proof_key := 'lifetime'; end if;
 -- Serialize repeat submissions for the same account and milestone.
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtextextended(p_user_id::text || ':' || kind || ':' || proof_key, 0)
 );
 select r.ledger_id into existing_id
 from public.buklod_r2_accomplishment_reviews r
 where r.user_id=p_user_id and r.activity_type=kind and r.milestone_key=proof_key;
 if existing_id is not null then
   return jsonb_build_object('already_awarded',true,'ledger_id',existing_id);
 end if;
 select * into rule_rec from public.buklod_point_rules r
 where r.activity_type=kind and r.is_active=true;
 if not found then raise exception 'R2 reward not activated by System Admin'; end if;
 factor := case level when 'easy' then 1 when 'medium' then 1.5
   when 'hard' then 2.5 else 4 end;
 amount := round(rule_rec.base_points::numeric * factor)::integer;
 if amount <= 0 or amount > 500 then raise exception 'Invalid configured reward'; end if;
 if rule_rec.max_points_per_event is not null
    and amount > rule_rec.max_points_per_event then
   raise exception 'Configured reward exceeds cap';
 end if;
 canonical_source := 'r2:v1:' || kind || ':' || proof_key;
 -- Existing admin reward RPC enforces admin identity, member state and caps.
 new_ledger_id := public.admin_award_buklod_points(
   p_user_id,kind,canonical_source,null,proof,amount
 );
 insert into public.buklod_r2_accomplishment_reviews
 (user_id,activity_type,milestone_key,difficulty,evidence_note,
  points_awarded,approved_by,ledger_id)
 values (p_user_id,kind,proof_key,level,proof,amount,actor,new_ledger_id);
 return jsonb_build_object('already_awarded',false,'ledger_id',new_ledger_id,
    'points',amount,'activity_type',kind);
end;
$$;
revoke all on function public.admin_award_buklod_r2_accomplishment_v1(uuid,text,text,text,text)
 from public,anon;
grant execute on function public.admin_award_buklod_r2_accomplishment_v1(uuid,text,text,text,text)
 to authenticated;
comment on function public.admin_award_buklod_r2_accomplishment_v1(uuid,text,text,text,text)
 is 'R2 evidence-reviewed admin-only idempotent milestone and difficulty reward path.';
