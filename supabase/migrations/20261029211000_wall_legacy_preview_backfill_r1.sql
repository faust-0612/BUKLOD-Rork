-- BUKLOD Legacy Photo Preview R1. Never rename/delete original media.
create table if not exists public.community_wall_legacy_previews (
 original_path text primary key, preview_path text unique not null,
 preview_bytes integer not null check(preview_bytes between 1 and 125000),
 created_at timestamptz not null default now(),
 constraint preview_path_derived check(preview_path=regexp_replace(original_path,'\.jpg$','-legacy-preview.jpg'))
);
alter table public.community_wall_legacy_previews enable row level security;
revoke all on public.community_wall_legacy_previews from public,anon,authenticated;
grant select on public.community_wall_legacy_previews to authenticated;
do $$ begin
 if not exists(select 1 from pg_policies where schemaname='public' and tablename='community_wall_legacy_previews' and policyname='buklod_wall_legacy_preview_visible') then
  create policy buklod_wall_legacy_preview_visible on public.community_wall_legacy_previews for select to authenticated
   using(public.buklod_storage_object_select_allowed_v1('community-media',original_path));
 end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='buklod_wall_legacy_preview_object_read') then
  create policy buklod_wall_legacy_preview_object_read on storage.objects for select to authenticated using(
   bucket_id='community-media' and name ~ '(^|/)post-[^/]+-legacy-preview\.jpg$'
   and exists(select 1 from public.community_wall_legacy_previews i where i.preview_path=objects.name
     and public.buklod_storage_object_select_allowed_v1('community-media',i.original_path))
  );
 end if;
end $$;
create table if not exists private.buklod_legacy_preview_queue(
 original_path text primary key, original_bytes bigint not null,
 status text not null default 'pending' check(status in('pending','processing','done','failed','skipped')),
 attempts integer not null default 0,next_attempt_at timestamptz not null default now(),
 leased_until timestamptz,last_error text,updated_at timestamptz not null default now()
);
create index if not exists buklod_legacy_preview_queue_ready on private.buklod_legacy_preview_queue(status,next_attempt_at);
revoke all on private.buklod_legacy_preview_queue from public,anon,authenticated;
create table if not exists private.buklod_legacy_preview_auth(
 id smallint primary key check(id=1), secret text not null,expires_at timestamptz not null,enabled boolean not null default false
);
revoke all on private.buklod_legacy_preview_auth from public,anon,authenticated;
insert into private.buklod_legacy_preview_auth(id,secret,expires_at,enabled)
values(1,encode(gen_random_bytes(32),'hex'),now()+interval '1 day',false)
on conflict(id) do nothing;
insert into private.buklod_legacy_preview_queue(original_path,original_bytes)
select src.path,max(src.sz) from (
 select m.media_path as path,m.media_size_bytes as sz from public.community_post_media m
 join public.community_posts cp on cp.id=m.post_id
 where m.media_mime_type='image/jpeg' and m.media_path ~ '(^|/)post-[^/]+\.jpg$'
 and cp.deleted_at is null and cp.is_hidden=false
 union all
 select cp.media_path,cp.media_size_bytes from public.community_posts cp
 where cp.media_mime_type='image/jpeg' and cp.media_path ~ '(^|/)post-[^/]+\.jpg$'
 and cp.deleted_at is null and cp.is_hidden=false
) src
where src.path is not null and src.sz between 20000 and 4000000 and src.path !~ '-p1(?:-preview)?\.jpg$'
group by src.path on conflict(original_path) do nothing;
create or replace function public.buklod_legacy_preview_worker_auth_v1(p_token text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.buklod_legacy_preview_auth a where a.id=1 and a.enabled and a.expires_at>now()
 and a.secret=coalesce(p_token,''));
$$;
revoke all on function public.buklod_legacy_preview_worker_auth_v1(text) from public,anon,authenticated;
grant execute on function public.buklod_legacy_preview_worker_auth_v1(text) to service_role;
create or replace function public.buklod_legacy_preview_claim_v1()
returns table(original_path text,original_bytes bigint) language plpgsql security definer set search_path='' as $$
begin
 update private.buklod_legacy_preview_queue q set
 status=case when attempts>=3 then 'failed' else 'pending' end,
 next_attempt_at=now(),updated_at=now()
 where status='processing' and leased_until<now();
 return query with picked as (
  select q.original_path from private.buklod_legacy_preview_queue q
  where q.status='pending' and q.next_attempt_at<=now() and q.attempts<3
  order by q.original_bytes,q.original_path for update skip locked limit 1
 ) update private.buklod_legacy_preview_queue q
 set status='processing',attempts=q.attempts+1,leased_until=now()+interval '5 minutes',updated_at=now()
 from picked where q.original_path=picked.original_path
 returning q.original_path,q.original_bytes;
end $$;
revoke all on function public.buklod_legacy_preview_claim_v1() from public,anon,authenticated;
grant execute on function public.buklod_legacy_preview_claim_v1() to service_role;
create or replace function public.buklod_legacy_preview_finish_v1(p_original_path text,p_result text,p_reason text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_result not in ('done','retry','skipped') then raise exception 'Invalid result'; end if;
 update private.buklod_legacy_preview_queue q
 set status=case when p_result='done' then 'done' when p_result='skipped' then 'skipped'
            when q.attempts>=3 then 'failed' else 'pending' end,
 next_attempt_at=now()+interval '15 minutes',leased_until=null,
 updated_at=now(),last_error=left(p_reason,240)
 where q.original_path=p_original_path and q.status='processing';
end $$;
revoke all on function public.buklod_legacy_preview_finish_v1(text,text,text) from public,anon,authenticated;
grant execute on function public.buklod_legacy_preview_finish_v1(text,text,text) to service_role;
create or replace function public.buklod_legacy_preview_backfill_stats_v1()
returns table(status text,total bigint) language sql stable security definer set search_path='' as $$
 select q.status,count(*) from private.buklod_legacy_preview_queue q group by q.status;
$$;
revoke all on function public.buklod_legacy_preview_backfill_stats_v1() from public,anon,authenticated;
grant execute on function public.buklod_legacy_preview_backfill_stats_v1() to service_role;
-- Adds preview metadata without changing existing RPC contracts.
create or replace function public.get_buklod_post_media_v3(p_post_ids uuid[])
returns table(post_id uuid,media_position smallint,media_path text,media_mime_type text,
 media_size_bytes bigint,storage_provider text,external_object_key text,
 reaction_counts jsonb,my_reaction text,preview_path text)
language sql stable security definer set search_path='' as $$
 select m.post_id,m.media_position,m.media_path,m.media_mime_type,m.media_size_bytes,
 m.storage_provider,m.external_object_key,
 coalesce((select jsonb_object_agg(g.reaction,g.total) from (
  select r.reaction,count(*)::bigint total from public.community_photo_reactions r
  where r.post_id=m.post_id and r.media_position=m.media_position group by r.reaction) g),'{}'::jsonb),
 (select mine.reaction from public.community_photo_reactions mine
  where mine.post_id=m.post_id and mine.media_position=m.media_position
  and mine.user_id=(select auth.uid()) limit 1),i.preview_path
 from public.community_post_media m
 left join public.community_wall_legacy_previews i on i.original_path=m.media_path
 where m.post_id=any(coalesce(p_post_ids,'{}'::uuid[])) and public.can_view_community_post_v2(m.post_id)
 union all
 select cp.id,0::smallint,cp.media_path,cp.media_mime_type,cp.media_size_bytes,
 'SUPABASE'::text,null::text,'{}'::jsonb,null::text,i.preview_path
 from public.community_posts cp
 left join public.community_wall_legacy_previews i on i.original_path=cp.media_path
 where cp.id=any(coalesce(p_post_ids,'{}'::uuid[])) and cp.media_path is not null
 and cp.media_mime_type in ('image/jpeg','image/png','image/webp')
 and public.can_view_community_post_v2(cp.id)
 and not exists(select 1 from public.community_post_media m where m.post_id=cp.id)
 order by 1,2;
$$;
revoke all on function public.get_buklod_post_media_v3(uuid[]) from public,anon;
grant execute on function public.get_buklod_post_media_v3(uuid[]) to authenticated,service_role;
