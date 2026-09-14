-- BUKLOD Community R2 Takeaway privacy separation.
-- Private summaries may synthesize poster-only replies; public Community Memory may not.

begin;

alter table public.buklod_community_takeaways
  add column if not exists public_summary text;

alter table public.buklod_community_takeaways
  drop constraint if exists buklod_community_takeaways_public_summary_check;
alter table public.buklod_community_takeaways
  add constraint buklod_community_takeaways_public_summary_check
  check (public_summary is null or char_length(trim(public_summary)) between 1 and 3000);

create or replace function public.set_buklod_community_takeaway_public_v1(p_post_id uuid,p_public boolean default true)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
  v_was_public boolean;
  v_public_summary text;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;
  select p.user_id into v_owner from public.community_posts p where p.id=p_post_id and p.deleted_at is null;
  if v_owner is distinct from v_actor then raise exception 'Only the original poster can share this Takeaway'; end if;
  select t.is_public,t.public_summary into v_was_public,v_public_summary
  from public.buklod_community_takeaways t where t.post_id=p_post_id;
  if not found then raise exception 'Takeaway is not ready yet'; end if;
  if coalesce(p_public,false) and nullif(trim(coalesce(v_public_summary,'')),'') is null then
    raise exception 'A privacy-safe public Takeaway is not ready yet';
  end if;
  update public.buklod_community_takeaways
    set is_public=coalesce(p_public,false),
        published_at=case when coalesce(p_public,false) then coalesce(published_at,now()) else null end,
        updated_at=now()
    where post_id=p_post_id;
  if coalesce(p_public,false) and not coalesce(v_was_public,false) then
    perform public.buklod_community_award_small_v1(
      v_actor,'community_takeaway_share','community_takeaway_share:'||p_post_id::text,1,
      'Shared an anonymized Community Takeaway'
    );
  end if;
  return jsonb_build_object('post_id',p_post_id,'is_public',coalesce(p_public,false));
end
$$;
revoke all on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) from public,anon;
grant execute on function public.set_buklod_community_takeaway_public_v1(uuid,boolean) to authenticated;

create or replace function public.get_buklod_dugtong_summary_v1(p_post_id uuid)
returns jsonb
language sql
security definer
set search_path=''
as $$
  select jsonb_build_object(
    'post_id',p.id,
    'kind',coalesce(m.kind,case when coalesce(p.media_mime_type,'') like 'image/%' then 'moment' else 'open_discussion' end),
    'status',coalesce(m.chain_status,'open'),
    'quiet_mode',coalesce(m.quiet_mode,false),
    'is_owner',p.user_id=(select auth.uid()),
    'context_config',coalesce(m.context_config,'{}'::jsonb),
    'reward_pot_points',greatest(0,least(10,coalesce((m.context_config->>'reward_pot_points')::integer,0))),
    'root_media_path',p.media_path,
    'public_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy in ('public','anonymous')),0),
    'private_count',case when p.user_id=(select auth.uid()) then coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved' and d.privacy='private_poster'),0) else 0 end,
    'branch_count',coalesce((select count(distinct d.branch_id) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.moderation_state='approved'),0),
    'helpful_count',coalesce((select count(*) from public.buklod_community_dugtongs d where d.root_post_id=p.id and d.deleted_at is null and d.is_helpful=true),0),
    'takeaway_summary',case
      when p.user_id=(select auth.uid()) then t.summary
      when t.is_public then t.public_summary
      else null
    end,
    'takeaway_public',coalesce(t.is_public,false)
  )
  from public.community_posts p
  left join public.buklod_community_post_meta m on m.post_id=p.id
  left join public.buklod_community_takeaways t on t.post_id=p.id and t.moderation_state='approved'
  where p.id=p_post_id and p.deleted_at is null
    and public.buklod_community_can_access_root_v1(p_post_id,(select auth.uid()))
$$;
revoke all on function public.get_buklod_dugtong_summary_v1(uuid) from public,anon;
grant execute on function public.get_buklod_dugtong_summary_v1(uuid) to authenticated;

create or replace function public.get_buklod_community_memory_v1(p_query text default null,p_limit integer default 30)
returns table(takeaway_id uuid,post_id uuid,summary text,kind text,topic text,created_at timestamptz)
language sql
security definer
set search_path=''
as $$
  select t.id,t.post_id,t.public_summary,coalesce(m.kind,'open_discussion'),m.topic,t.created_at
  from public.buklod_community_takeaways t
  join public.buklod_community_post_meta m on m.post_id=t.post_id
  join public.community_posts p on p.id=t.post_id
  where t.is_public=true and t.moderation_state='approved'
    and nullif(trim(coalesce(t.public_summary,'')),'') is not null
    and p.deleted_at is null and coalesce(p.is_hidden,false)=false
    and (
      nullif(trim(coalesce(p_query,'')),'') is null
      or to_tsvector('simple',coalesce(t.public_summary,'')||' '||coalesce(m.title,'')||' '||coalesce(m.topic,'')) @@ plainto_tsquery('simple',trim(p_query))
    )
  order by t.created_at desc
  limit greatest(1,least(coalesce(p_limit,30),60))
$$;
revoke all on function public.get_buklod_community_memory_v1(text,integer) from public,anon;
grant execute on function public.get_buklod_community_memory_v1(text,integer) to authenticated;

commit;
