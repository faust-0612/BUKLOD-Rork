-- BUKLOD Today's Best/Wall Points V4.
-- This variant is the marked Marites story rail inside Wall, NOT the
-- separate weekly BUKLOD Today helpful-tip card.
-- Keep non-story R37 reward routing intact. Story-specific routes avoid
-- double R37 BP milestones; QMP has its independent vetted pipeline.
-- All awards are noncash pending BP, never contingent on advertisements.

create or replace function private.buklod_is_todays_best_post_v4(p_post uuid)
returns boolean language sql stable security definer set search_path=''
as $$
 select exists(select 1 from public.community_posts p
  where p.id=p_post and
    (pg_catalog.strpos(coalesce(p.body,''),
      pg_catalog.chr(8203)||pg_catalog.chr(8204)||
      pg_catalog.chr(8205)||pg_catalog.chr(8288))>0
     or coalesce(p.media_path,'') like '%marites-%'))
$$;
revoke all on function private.buklod_is_todays_best_post_v4(uuid)
 from public,anon,authenticated;

create or replace function private.buklod_reward_social_text_v4(p_text text)
returns text language sql immutable set search_path=''
as $$
 select lower(pg_catalog.regexp_replace(
   pg_catalog.regexp_replace(pg_catalog.btrim(coalesce(p_text,'')),
      '[^[:alnum:][:space:]]','','g'),
   '[[:space:]]+',' ','g'))
$$;
revoke all on function private.buklod_reward_social_text_v4(text)
 from public,anon,authenticated;

create or replace function private.buklod_comment_reward_eligible_v4(p_comment uuid)
returns boolean language plpgsql stable security definer set search_path=''
as $comment$
declare
 v_comment public.comments%rowtype;
 v_post public.community_posts%rowtype;
 v_norm text;
 v_words integer;
 v_today date:=(now() at time zone 'Asia/Manila')::date;
 v_awarded bigint;
begin
 select * into v_comment from public.comments where id=p_comment;
 if v_comment.id is null or v_comment.user_id is null or
    v_comment.is_hidden or v_comment.deleted_at is not null then return false; end if;
 select * into v_post from public.community_posts where id=v_comment.post_id;
 if v_post.id is null or v_post.is_hidden or v_post.deleted_at is not null or
    v_post.user_id=v_comment.user_id then return false; end if;
 v_norm:=private.buklod_reward_social_text_v4(v_comment.body);
 v_words:=coalesce(pg_catalog.array_length(pg_catalog.regexp_split_to_array(v_norm,' '),1),0);
 if pg_catalog.char_length(v_norm)<20 or v_words<3 or
    v_norm in ('thank you very much','amen amen amen','good morning everyone') then
   return false;
 end if;
 if exists(select 1 from public.comments c
   where c.user_id=v_comment.user_id and c.id<>v_comment.id and
         c.created_at<v_comment.created_at and
         c.created_at>=v_comment.created_at-interval '7 days' and
         private.buklod_reward_social_text_v4(c.body)=v_norm) then
   return false;
 end if;
 -- Reward cap shared by Today's Best comments and existing R37 Wall.
 select count(*)::bigint into v_awarded from public.buklod_points_ledger l
 where l.user_id=v_comment.user_id and l.direction='credit'
   and l.activity_type in (
     'community_comment','r36_engager_comment','r36_engager_reply','todays_best_comment')
   and (l.created_at at time zone 'Asia/Manila')::date=v_today;
 return v_awarded<5;
end;
$comment$;
revoke all on function private.buklod_comment_reward_eligible_v4(uuid)
 from public,anon,authenticated;

create or replace function private.buklod_todays_best_streak_v4(p_user uuid)
returns void language plpgsql security definer set search_path=''
as $streak$
declare
 v_day date:=(now() at time zone 'Asia/Manila')::date;
 v_count integer;
 v_points integer;
 v_key text;
begin
 select count(distinct (l.created_at at time zone 'Asia/Manila')::date)
 into v_count from public.buklod_points_ledger l
 where l.user_id=p_user and l.direction='credit'
   and l.activity_type in ('todays_best_story','todays_best_comment','todays_best_reaction')
   and (l.created_at at time zone 'Asia/Manila')::date
       between v_day-6 and v_day;
 if v_count<>7 then return; end if;
 select r.base_points into v_points
 from public.buklod_point_rules r
 where r.activity_type='todays_best_streak' and r.is_active=true
   and r.base_points=10;
 if v_points is null then return; end if;
 -- One weekly streak award, never seven overlapping awards in one week.
 v_key:='todays_best:7day:'||to_char(v_day,'IYYY-IW');
 insert into public.buklod_points_ledger(
   user_id,direction,points,activity_type,source_key,description)
 values(p_user,'credit',v_points,'todays_best_streak',v_key,
        'Seven verified days of Today''s Best participation')
 on conflict(user_id,source_key) do nothing;
end;
$streak$;
revoke all on function private.buklod_todays_best_streak_v4(uuid)
 from public,anon,authenticated;

create or replace function private.buklod_award_todays_best_post_v4(p_post uuid)
returns void language plpgsql security definer set search_path=''
as $story$
declare
 v_post public.community_posts%rowtype;
 v_norm text;
 v_count bigint;
 v_points integer;
begin
 select * into v_post from public.community_posts p where p.id=p_post;
 if v_post.id is null or v_post.user_id is null or v_post.is_hidden or
    v_post.deleted_at is not null or v_post.is_reel or
    not private.buklod_is_todays_best_post_v4(v_post.id) or
    private.buklod_is_platform_official_v1(v_post.user_id) then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-best-post-v4'),
   pg_catalog.hashtext(v_post.user_id::text));
 select count(*)::bigint into v_count from public.buklod_points_ledger l
 where l.user_id=v_post.user_id and l.activity_type='todays_best_story'
   and l.direction='credit' and
       (l.created_at at time zone 'Asia/Manila')::date=
       (now() at time zone 'Asia/Manila')::date;
 if v_count>=3 then return; end if;
 if exists(select 1 from public.buklod_points_ledger l
   where l.user_id=v_post.user_id and l.activity_type='todays_best_story'
     and l.created_at>now()-interval '5 minutes') then return; end if;
 v_norm:=private.buklod_reward_social_text_v4(
   pg_catalog.replace(v_post.body,
      pg_catalog.chr(8203)||pg_catalog.chr(8204)||
      pg_catalog.chr(8205)||pg_catalog.chr(8288),''));
 if exists(select 1 from public.community_posts p
  where p.user_id=v_post.user_id and p.id<>v_post.id
    and p.created_at<=v_post.created_at and
        p.created_at>v_post.created_at-interval '7 days'
    and private.buklod_is_todays_best_post_v4(p.id)
    and private.buklod_reward_social_text_v4(
       pg_catalog.replace(p.body,
         pg_catalog.chr(8203)||pg_catalog.chr(8204)||
         pg_catalog.chr(8205)||pg_catalog.chr(8288),''))=v_norm
    and coalesce(p.media_path,'')=coalesce(v_post.media_path,'')
 ) then return; end if;
 select base_points into v_points from public.buklod_point_rules
 where activity_type='todays_best_story' and is_active=true and base_points=2;
 if v_points is null then return; end if;
 insert into public.buklod_points_ledger(
 user_id,direction,points,activity_type,source_key,source_id,description)
 values(v_post.user_id,'credit',v_points,'todays_best_story',
        'todays_best:story:'||v_post.id::text,v_post.id,'Verified Today''s Best story')
 on conflict(user_id,source_key) do nothing;
 perform private.buklod_todays_best_streak_v4(v_post.user_id);
end;
$story$;
revoke all on function private.buklod_award_todays_best_post_v4(uuid)
 from public,anon,authenticated;

create or replace function private.buklod_award_todays_best_comment_v4(p_comment uuid)
returns void language plpgsql security definer set search_path=''
as $c$
declare
 v public.comments%rowtype;
 v_pts integer;
begin
 select * into v from public.comments where id=p_comment;
 if v.id is null or not private.buklod_comment_reward_eligible_v4(p_comment)
    or not private.buklod_is_todays_best_post_v4(v.post_id) then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-best-comment-v4'),
   pg_catalog.hashtext(v.user_id::text));
 -- Recheck cap after lock to prevent concurrent earning storms.
 if not private.buklod_comment_reward_eligible_v4(p_comment) then return; end if;
 select base_points into v_pts from public.buklod_point_rules
 where activity_type='todays_best_comment' and is_active and base_points=2;
 if v_pts is null then return; end if;
 insert into public.buklod_points_ledger(
   user_id,direction,points,activity_type,source_key,source_id,description)
 values(v.user_id,'credit',v_pts,'todays_best_comment',
        'todays_best:comment:'||v.id::text,v.id,'Meaningful Today''s Best comment')
 on conflict(user_id,source_key) do nothing;
 perform private.buklod_todays_best_streak_v4(v.user_id);
end;
$c$;
revoke all on function private.buklod_award_todays_best_comment_v4(uuid)
 from public,anon,authenticated;

create or replace function private.buklod_award_todays_best_reaction_v4(
 p_post uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=''
as $r$
declare
 v_owner uuid;
 v_pts integer;
 v_day date:=(now() at time zone 'Asia/Manila')::date;
 v_count integer;
begin
 if not private.buklod_is_todays_best_post_v4(p_post) then return; end if;
 select p.user_id into v_owner from public.community_posts p
 where p.id=p_post and not p.is_hidden and p.deleted_at is null;
 if v_owner is null or v_owner=p_actor or
   not exists(select 1 from public.reactions r where r.post_id=p_post and r.user_id=p_actor)
   or private.buklod_is_platform_official_v1(p_actor) then return; end if;
 perform pg_catalog.pg_advisory_xact_lock(
   pg_catalog.hashtext('buklod-best-reaction-v4'),
   pg_catalog.hashtext(p_actor::text));
 select count(*)::integer into v_count from public.buklod_points_ledger l
 where l.user_id=p_actor and l.activity_type='todays_best_reaction'
 and l.direction='credit'
 and (l.created_at at time zone 'Asia/Manila')::date=v_day;
 if v_count>=5 then return; end if;
 select base_points into v_pts from public.buklod_point_rules
 where activity_type='todays_best_reaction' and is_active=true and base_points=1;
 if v_pts is null then return; end if;
 insert into public.buklod_points_ledger(
 user_id,direction,points,activity_type,source_key,source_id,description)
 values(p_actor,'credit',v_pts,'todays_best_reaction',
   'todays_best:reaction:'||p_post::text,p_post,'Verified Today''s Best reaction')
 on conflict(user_id,source_key) do nothing;
 perform private.buklod_todays_best_streak_v4(p_actor);
end;
$r$;
revoke all on function private.buklod_award_todays_best_reaction_v4(uuid,uuid)
 from public,anon,authenticated;

-- Safe coexistence with canonical R37. Replace only the three existing
-- trigger FUNCTIONS; do not disable R37, QMP, AdMob or any other trigger.
create or replace function public.community_post_points_trigger_v2()
returns trigger language plpgsql security definer set search_path=''
as $post_v4$
begin
 if private.buklod_is_platform_official_v1(new.user_id) then return new; end if;
 if private.buklod_is_todays_best_post_v4(new.id) then
   perform private.buklod_award_todays_best_post_v4(new.id);
 elsif private.buklod_r37_social_route_v1()='r37' then
   perform private.buklod_r36_settle_publish_v1(new.id,'r37_standard_social_points_v1');
 else
   perform public.credit_community_social_points_v2(new.user_id,'community_post',
     'community_post:'||new.id::text,new.id);
 end if;
 return new;
end;
$post_v4$;

create or replace function public.community_comment_points_trigger_v2()
returns trigger language plpgsql security definer set search_path=''
as $comment_v4$
begin
 if not private.buklod_comment_reward_eligible_v4(new.id) then return new; end if;
 if private.buklod_is_todays_best_post_v4(new.post_id) then
   perform private.buklod_award_todays_best_comment_v4(new.id);
 elsif private.buklod_r37_social_route_v1()='r37' then
   perform private.buklod_r36_process_comment_v1(new.id,'r37_standard_social_points_v1');
 else
   perform public.credit_community_social_points_v2(new.user_id,'community_comment',
     'community_comment:'||new.id::text,new.id);
 end if;
 return new;
end;
$comment_v4$;

create or replace function public.community_reaction_points_trigger_v2()
returns trigger language plpgsql security definer set search_path=''
as $reaction_v4$
begin
 if private.buklod_is_todays_best_post_v4(new.post_id) then
   perform private.buklod_award_todays_best_reaction_v4(new.post_id,new.user_id);
 elsif private.buklod_r37_social_route_v1()='r37' then
   perform private.buklod_r36_process_reaction_v1(new.post_id,new.user_id,'r37_standard_social_points_v1');
 else
   perform public.credit_community_social_points_v2(new.user_id,'community_reaction',
      'community_reaction:'||new.post_id::text||':'||new.user_id::text,new.post_id);
 end if;
 return new;
end;
$reaction_v4$;

update public.buklod_point_rules set is_active=true,updated_at=now()
where activity_type in (
 'todays_best_story','todays_best_comment','todays_best_reaction','todays_best_streak'
);
