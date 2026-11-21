-- BUKLOD Season 2 estate engine. STAGING FIRST: never deploy to MAIN without RC validation.
-- Estate XP/materials are independent of BP/QMP/Character Diamonds; never mint BP.
create table if not exists public.buklod_estate_wallet_v1 (
  owner_kind text not null check (owner_kind in ('USER','SCOPE')),
  owner_id uuid not null,
  development_xp bigint not null default 0 check (development_xp>=0),
  timber bigint not null default 0 check (timber>=0),
  stone bigint not null default 0 check (stone>=0),
  metal bigint not null default 0 check (metal>=0),
  updated_at timestamptz not null default now(),
  primary key (owner_kind,owner_id)
);
create table if not exists public.buklod_estate_progress_v1 (
  owner_kind text not null check (owner_kind in ('USER','SCOPE')),
  owner_id uuid not null,
  track text not null check (track in ('lot','house','cluster')),
  level integer not null default 1 check (level between 1 and 10),
  stage integer not null default 0 check (stage between 0 and 4),
  mastery bigint not null default 0 check (mastery between 0 and 9007199254740991),
  build_finish_at timestamptz,
  pending_key text,
  cosmetics jsonb not null default '{"finish":"stone","roof":"gable","ground":"grass","fence":"wood","windows":"classic","lights":"warm"}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_kind,owner_id,track),
  constraint estate_track_owner_match check
    ((owner_kind='USER' and track in ('lot','house')) or
     (owner_kind='SCOPE' and track='cluster')),
  constraint estate_pending_consistency check
    ((pending_key is null and build_finish_at is null) or
     (pending_key is not null and build_finish_at is not null))
);
create table if not exists public.buklod_estate_event_v1 (
  id bigint generated always as identity primary key,
  source_key text not null unique,
  event_type text not null,
  owner_kind text not null,
  owner_id uuid not null,
  actor_id uuid,
  development_xp bigint not null default 0,
  timber bigint not null default 0,
  stone bigint not null default 0,
  metal bigint not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.buklod_estate_build_v1 (
  operation_key text primary key,
  owner_kind text not null,
  owner_id uuid not null,
  track text not null,
  actor_id uuid not null,
  from_level integer not null,
  from_stage integer not null,
  from_mastery bigint not null,
  ready_at timestamptz not null,
  cost jsonb not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists buklod_estate_build_owner_idx on public.buklod_estate_build_v1(owner_kind,owner_id,track,created_at desc);
create index if not exists buklod_estate_event_owner_idx on public.buklod_estate_event_v1(owner_kind,owner_id,created_at desc);
alter table public.buklod_estate_wallet_v1 enable row level security;
alter table public.buklod_estate_progress_v1 enable row level security;
alter table public.buklod_estate_event_v1 enable row level security;
alter table public.buklod_estate_build_v1 enable row level security;
revoke all on public.buklod_estate_wallet_v1, public.buklod_estate_progress_v1,
 public.buklod_estate_event_v1, public.buklod_estate_build_v1 from public,anon,authenticated;
-- No direct client SELECT/INSERT/UPDATE access: read through the verified RPC.
-- This prevents private helper execute permissions from leaking into Data API.
create schema if not exists buklod_estate_private;
revoke all on schema buklod_estate_private from public,anon,authenticated;

create or replace function buklod_estate_private.allowed(
 p_kind text,p_id uuid,p_track text,p_write boolean default false
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare v_user uuid:=auth.uid(); v_is_member boolean; v_is_admin boolean;
begin
 if v_user is null or p_id is null then return false; end if;
 if p_kind='USER' then
   return p_id=v_user and p_track in ('lot','house');
 end if;
 if p_kind<>'SCOPE' or p_track<>'cluster' then return false; end if;
 select exists(
   select 1 from public.buklod_scopes s
   join public.buklod_scope_memberships m on m.scope_id=s.id
   where s.id=p_id and s.scope_type in ('CLUSTER','ORGANIZATION','SUB_ORGANIZATION')
     and s.status='ACTIVE' and s.archived_at is null and m.user_id=v_user and m.membership_status='ACTIVE'
 ) into v_is_member;
 if not v_is_member then return false; end if;
 if not p_write then return true; end if;
 select exists(
   select 1 from public.buklod_scopes s where s.id=p_id and s.created_by=v_user
 ) or exists(
   select 1 from public.buklod_scope_role_assignments r
   where r.scope_id=p_id and r.user_id=v_user and r.status='ACTIVE'
     and r.revoked_at is null and lower(r.role_key) in ('owner','admin','leader','organizer','cluster_admin','org_admin')
 ) into v_is_admin;
 return coalesce(v_is_admin,false);
end $$;
revoke all on function buklod_estate_private.allowed(text,uuid,text,boolean) from public,anon,authenticated;

-- Cost quote and debit are computed by the same PostgreSQL function.
create or replace function buklod_estate_private.cost(
 p_track text,p_level integer,p_stage integer,p_mastery bigint
) returns jsonb language plpgsql immutable
set search_path=pg_catalog,public as $$
declare f numeric;l integer;p integer;
begin
 if p_track not in ('lot','house','cluster') or p_level not between 1 and 10
   or p_stage not between 0 and 4 or p_mastery<0
 then raise exception 'Invalid estate milestone' using errcode='22023'; end if;
 l:=p_level;p:=p_stage;
 f:=(case p_track when 'lot' then 1 when 'house' then 1.45 else 2.5 end)
   * (case when l=10 then 1+ln((p_mastery+1)::numeric)/ln(2::numeric)/4 else 1 end);
 return jsonb_build_object(
   'development_xp',ceil((18+6*l*l+9*p*(l+1))*f)::bigint,
   'timber',ceil((3+l*2+p*2)*f)::bigint,
   'stone',ceil((2+l*l+p*2)*f)::bigint,
   'metal',ceil((l+p+1)*f/2)::bigint,
   'build_minutes',ceil((5+l*l*3+p*l*2)*f)::integer
 );
end $$;
revoke all on function buklod_estate_private.cost(text,integer,integer,bigint) from public,anon,authenticated;

create or replace function public.get_buklod_estate_snapshot_v1(
 p_owner_kind text,p_owner_id uuid,p_track text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,public as $$
declare s public.buklod_estate_progress_v1%rowtype; w public.buklod_estate_wallet_v1%rowtype;
begin
 if not buklod_estate_private.allowed(p_owner_kind,p_owner_id,p_track,false)
 then raise exception 'Estate access denied' using errcode='42501'; end if;
 select * into s from public.buklod_estate_progress_v1
  where owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track;
 select * into w from public.buklod_estate_wallet_v1
  where owner_kind=p_owner_kind and owner_id=p_owner_id;
 return jsonb_build_object(
   'server_verified',true,
   'can_build',buklod_estate_private.allowed(p_owner_kind,p_owner_id,p_track,true),
   'owner_kind',p_owner_kind,'owner_id',p_owner_id,'track',p_track,
   'level',coalesce(s.level,1),'stage',coalesce(s.stage,0),
   'mastery',coalesce(s.mastery,0),'build_finish_at',s.build_finish_at,
   'pending_key',s.pending_key,
   'next_cost',buklod_estate_private.cost(p_track,coalesce(s.level,1),coalesce(s.stage,0),coalesce(s.mastery,0)),
   'cosmetics',coalesce(s.cosmetics,'{"finish":"stone","roof":"gable","ground":"grass","fence":"wood","windows":"classic","lights":"warm"}'::jsonb),
   'wallet',jsonb_build_object('development_xp',coalesce(w.development_xp,0),
     'timber',coalesce(w.timber,0),'stone',coalesce(w.stone,0),'metal',coalesce(w.metal,0)),
   'updated_at',coalesce(s.updated_at,w.updated_at)
 );
end $$;

-- Server-only verified participation grants; idempotent by immutable source event ID.
create or replace function public.award_buklod_estate_resources_v1(
 p_user_id uuid,p_event_key text,p_xp bigint,p_timber bigint,p_stone bigint,p_metal bigint
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
 if p_user_id is null or p_xp is null or p_timber is null or p_stone is null or p_metal is null
 or length(coalesce(p_event_key,'')) not between 6 and 180
  or p_xp not between 0 and 1000 or p_timber not between 0 and 100
  or p_stone not between 0 and 100 or p_metal not between 0 and 100
  or p_xp+p_timber+p_stone+p_metal<=0 then
  raise exception 'Invalid verified estate grant' using errcode='22023';
 end if;
 insert into public.buklod_estate_event_v1
 (source_key,event_type,owner_kind,owner_id,actor_id,development_xp,timber,stone,metal)
 values (p_event_key,'VERIFIED_PARTICIPATION','USER',p_user_id,p_user_id,p_xp,p_timber,p_stone,p_metal)
 on conflict(source_key) do nothing;
 if not found then return false; end if;
 insert into public.buklod_estate_wallet_v1(owner_kind,owner_id,development_xp,timber,stone,metal)
 values ('USER',p_user_id,p_xp,p_timber,p_stone,p_metal)
 on conflict(owner_kind,owner_id) do update set
  development_xp=public.buklod_estate_wallet_v1.development_xp+excluded.development_xp,
  timber=public.buklod_estate_wallet_v1.timber+excluded.timber,
  stone=public.buklod_estate_wallet_v1.stone+excluded.stone,
  metal=public.buklod_estate_wallet_v1.metal+excluded.metal,updated_at=now();
 return true;
end $$;

-- Only trusted, claimed participation ledger entries may issue estate resources.
-- No backfill. An inserted pending ledger row receives nothing until it is claimed.
create or replace function buklod_estate_private.credit_claimed_participation()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_points integer;
begin
 if new.direction='credit' and new.claim_state='claimed'
   and new.points>0
   and new.activity_type in (
     'scope_attendance','learning_progress_verification','abc_growth_lesson',
     'community_mutual_support_chain','game_first_qualified','daily_bible',
     'devotional','reflection_quality_bonus','r36_creator_impact'
   ) then
   v_points:=least(80,greatest(8,new.points));
   perform public.award_buklod_estate_resources_v1(
     new.user_id,'bp-ledger:'||new.id::text,v_points,
     greatest(1,ceil(v_points::numeric/12)::integer),
     greatest(1,ceil(v_points::numeric/18)::integer),
     greatest(1,ceil(v_points::numeric/30)::integer)
   );
 end if;
 return new;
end $$;
drop trigger if exists trg_buklod_estate_verified_claim on public.buklod_points_ledger;
create trigger trg_buklod_estate_verified_claim
 after insert or update of claim_state on public.buklod_points_ledger
 for each row execute function buklod_estate_private.credit_claimed_participation();

-- Transfers only existing materials from a member to their ACTIVE verified scope.
create or replace function public.contribute_buklod_estate_resources_v1(
 p_scope_id uuid,p_operation_key text,p_xp bigint,p_timber bigint,p_stone bigint,p_metal bigint
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare u uuid:=auth.uid(); w public.buklod_estate_wallet_v1%rowtype;
begin
 if u is null or not buklod_estate_private.allowed('SCOPE',p_scope_id,'cluster',false)
 then raise exception 'Verified scope membership required' using errcode='42501'; end if;
 if p_xp is null or p_timber is null or p_stone is null or p_metal is null
   or length(coalesce(p_operation_key,'')) not between 12 and 160
   or p_xp not between 0 and 1000000 or p_timber not between 0 and 1000000
   or p_stone not between 0 and 1000000 or p_metal not between 0 and 1000000
   or p_xp+p_timber+p_stone+p_metal<1 then
    raise exception 'Invalid contribution' using errcode='22023';
 end if;
 insert into public.buklod_estate_wallet_v1(owner_kind,owner_id) values ('USER',u) on conflict do nothing;
 select * into w from public.buklod_estate_wallet_v1 where owner_kind='USER' and owner_id=u for update;
 if exists(select 1 from public.buklod_estate_event_v1 where source_key='scope-donate:'||u||':'||p_operation_key) then
    if not exists(select 1 from public.buklod_estate_event_v1
      where source_key='scope-donate:'||u||':'||p_operation_key and owner_id=p_scope_id
      and actor_id=u and development_xp=p_xp and timber=p_timber and stone=p_stone and metal=p_metal)
    then raise exception 'Operation key already used for another scope' using errcode='23505'; end if;
    return public.get_buklod_estate_snapshot_v1('SCOPE',p_scope_id,'cluster');
 end if;
 if w.development_xp<p_xp or w.timber<p_timber or w.stone<p_stone or w.metal<p_metal
 then raise exception 'Not enough verified materials' using errcode='P0001'; end if;
 insert into public.buklod_estate_event_v1(source_key,event_type,owner_kind,owner_id,actor_id,development_xp,timber,stone,metal)
 values('scope-donate:'||u||':'||p_operation_key,'TRANSFER_TO_SCOPE','SCOPE',p_scope_id,u,p_xp,p_timber,p_stone,p_metal);
 update public.buklod_estate_wallet_v1 set
  development_xp=development_xp-p_xp,timber=timber-p_timber,stone=stone-p_stone,
  metal=metal-p_metal,updated_at=now() where owner_kind='USER' and owner_id=u;
 insert into public.buklod_estate_wallet_v1(owner_kind,owner_id,development_xp,timber,stone,metal)
 values('SCOPE',p_scope_id,p_xp,p_timber,p_stone,p_metal)
 on conflict(owner_kind,owner_id) do update set
  development_xp=public.buklod_estate_wallet_v1.development_xp+excluded.development_xp,
  timber=public.buklod_estate_wallet_v1.timber+excluded.timber,
  stone=public.buklod_estate_wallet_v1.stone+excluded.stone,
  metal=public.buklod_estate_wallet_v1.metal+excluded.metal,updated_at=now();
 return public.get_buklod_estate_snapshot_v1('SCOPE',p_scope_id,'cluster');
end $$;

create or replace function public.start_buklod_estate_construction_v1(
 p_owner_kind text,p_owner_id uuid,p_track text,p_operation_key text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare s public.buklod_estate_progress_v1%rowtype;
 w public.buklod_estate_wallet_v1%rowtype; q jsonb; xp bigint; t bigint; st bigint; m bigint; minutes integer;
begin
 if not buklod_estate_private.allowed(p_owner_kind,p_owner_id,p_track,true)
 then raise exception 'Not authorized to build this estate' using errcode='42501'; end if;
 if length(coalesce(p_operation_key,'')) not between 12 and 160
 then raise exception 'Invalid operation key' using errcode='22023'; end if;
 insert into public.buklod_estate_progress_v1(owner_kind,owner_id,track)
 values(p_owner_kind,p_owner_id,p_track) on conflict do nothing;
 select * into s from public.buklod_estate_progress_v1
  where owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track for update;
 if exists(select 1 from public.buklod_estate_build_v1
   where operation_key=p_operation_key and actor_id=auth.uid() and owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track)
 then return public.get_buklod_estate_snapshot_v1(p_owner_kind,p_owner_id,p_track); end if;
 if exists(select 1 from public.buklod_estate_build_v1 where operation_key=p_operation_key)
 then raise exception 'Operation key already used' using errcode='23505'; end if;
 if s.pending_key is not null then
  raise exception 'Finish the current construction before starting another' using errcode='P0001';
 end if;
 q:=buklod_estate_private.cost(p_track,s.level,s.stage,s.mastery);
 xp:=(q->>'development_xp')::bigint;
 t:=(q->>'timber')::bigint;
 st:=(q->>'stone')::bigint;
 m:=(q->>'metal')::bigint;
 minutes:=(q->>'build_minutes')::integer;
 -- Each verified lot/house/cluster uses its own wallet. No BP is debited or minted.
 insert into public.buklod_estate_wallet_v1(owner_kind,owner_id)
 values(p_owner_kind,p_owner_id) on conflict do nothing;
 select * into w from public.buklod_estate_wallet_v1
 where owner_kind=p_owner_kind and owner_id=p_owner_id for update;
 if w.development_xp<xp or w.timber<t or w.stone<st or w.metal<m
 then raise exception 'Earn or contribute more verified materials before construction' using errcode='P0001'; end if;
 update public.buklod_estate_wallet_v1 set
 development_xp=development_xp-xp,timber=timber-t,stone=stone-st,metal=metal-m,updated_at=now()
 where owner_kind=p_owner_kind and owner_id=p_owner_id;
 insert into public.buklod_estate_build_v1(operation_key,owner_kind,owner_id,track,actor_id,
 from_level,from_stage,from_mastery,ready_at,cost)
 values(p_operation_key,p_owner_kind,p_owner_id,p_track,auth.uid(),
 s.level,s.stage,s.mastery,now()+make_interval(mins=>minutes),
 jsonb_build_object('development_xp',xp,'timber',t,'stone',st,'metal',m));
 update public.buklod_estate_progress_v1 set
 pending_key=p_operation_key,build_finish_at=now()+make_interval(mins=>minutes),updated_at=now()
 where owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track;
 return public.get_buklod_estate_snapshot_v1(p_owner_kind,p_owner_id,p_track);
end $$;

create or replace function public.complete_buklod_estate_construction_v1(
 p_owner_kind text,p_owner_id uuid,p_track text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare s public.buklod_estate_progress_v1%rowtype;
begin
 if not buklod_estate_private.allowed(p_owner_kind,p_owner_id,p_track,true)
 then raise exception 'Not authorized to finish this estate' using errcode='42501'; end if;
 select * into s from public.buklod_estate_progress_v1
 where owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track for update;
 if not found or s.pending_key is null
 then return public.get_buklod_estate_snapshot_v1(p_owner_kind,p_owner_id,p_track); end if;
 if s.build_finish_at>now()
 then raise exception 'Construction is still in progress' using errcode='P0001'; end if;
 if s.level=10 and s.stage=4 and s.mastery>=9007199254740991
 then raise exception 'Mastery exceeds safe numeric range' using errcode='22003'; end if;
 update public.buklod_estate_progress_v1 set
 level=case when s.stage=4 and s.level<10 then s.level+1 else s.level end,
 stage=case when s.stage=4 then 0 else s.stage+1 end,
 mastery=case when s.stage=4 and s.level=10 then s.mastery+1 else s.mastery end,
 pending_key=null,build_finish_at=null,updated_at=now()
 where owner_kind=p_owner_kind and owner_id=p_owner_id and track=p_track;
 update public.buklod_estate_build_v1 set completed_at=now()
 where operation_key=s.pending_key and completed_at is null;
 return public.get_buklod_estate_snapshot_v1(p_owner_kind,p_owner_id,p_track);
end $$;

create or replace function public.save_buklod_estate_design_v1(
 p_owner_kind text,p_owner_id uuid,p_track text,p_design jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public as $$
declare v_finish text;v_roof text;v_ground text;v_fence text;v_windows text;v_lights text;
begin
 if not buklod_estate_private.allowed(p_owner_kind,p_owner_id,p_track,true)
 then raise exception 'Only authorized owners/admins can save this design' using errcode='42501'; end if;
 if p_design is null or jsonb_typeof(p_design)<>'object'
 then raise exception 'Invalid design' using errcode='22023'; end if;
 v_finish:=p_design->>'finish';v_roof:=p_design->>'roof';v_ground:=p_design->>'ground';
 v_fence:=p_design->>'fence';v_windows:=p_design->>'windows';v_lights:=p_design->>'lights';
 if v_finish is null or v_finish not in ('stone','timber','garden','slate','clay','light')
 or v_roof is null or v_roof not in ('gable','hip','terrace')
 or v_ground is null or v_ground not in ('grass','flower','stone')
 or v_fence is null or v_fence not in ('wood','iron','hedge')
 or v_windows is null or v_windows not in ('classic','panorama','arched')
 or v_lights is null or v_lights not in ('warm','starlight','garden')
 then raise exception 'Unsupported cosmetic choice' using errcode='22023'; end if;
 insert into public.buklod_estate_progress_v1(owner_kind,owner_id,track,cosmetics)
 values(p_owner_kind,p_owner_id,p_track,
 jsonb_build_object('finish',v_finish,'roof',v_roof,'ground',v_ground,
 'fence',v_fence,'windows',v_windows,'lights',v_lights))
 on conflict(owner_kind,owner_id,track) do update set
 cosmetics=excluded.cosmetics,updated_at=now();
 return public.get_buklod_estate_snapshot_v1(p_owner_kind,p_owner_id,p_track);
end $$;
-- Revoke PUBLIC defaults on privileged RPCs; grant only deliberately supported entry points.
revoke all on function public.get_buklod_estate_snapshot_v1(text,uuid,text) from public,anon;
revoke all on function public.award_buklod_estate_resources_v1(uuid,text,bigint,bigint,bigint,bigint) from public,anon,authenticated;
revoke all on function public.contribute_buklod_estate_resources_v1(uuid,text,bigint,bigint,bigint,bigint) from public,anon;
revoke all on function public.start_buklod_estate_construction_v1(text,uuid,text,text) from public,anon;
revoke all on function public.complete_buklod_estate_construction_v1(text,uuid,text) from public,anon;
revoke all on function public.save_buklod_estate_design_v1(text,uuid,text,jsonb) from public,anon;
grant execute on function public.get_buklod_estate_snapshot_v1(text,uuid,text) to authenticated;
grant execute on function public.contribute_buklod_estate_resources_v1(uuid,text,bigint,bigint,bigint,bigint) to authenticated;
grant execute on function public.start_buklod_estate_construction_v1(text,uuid,text,text) to authenticated;
grant execute on function public.complete_buklod_estate_construction_v1(text,uuid,text) to authenticated;
grant execute on function public.save_buklod_estate_design_v1(text,uuid,text,jsonb) to authenticated;
grant execute on function public.award_buklod_estate_resources_v1(uuid,text,bigint,bigint,bigint,bigint) to service_role;
