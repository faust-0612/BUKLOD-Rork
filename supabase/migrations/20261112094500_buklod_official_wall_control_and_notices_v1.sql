-- BUKLOD Official audited Wall control, individual notices and bounded broadcast.
-- Prerequisite: protected identity migration; no user posts/media are deleted.
create table if not exists private.buklod_official_wall_audit_v1(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 post_id uuid not null references public.community_posts(id),
 action text not null check(action in ('HIDE','RESTORE')),
 prior_hidden boolean not null,
 new_hidden boolean not null,
 reason text not null,
 created_at timestamptz not null default now()
);
create index if not exists buklod_official_wall_audit_post_idx
 on private.buklod_official_wall_audit_v1(post_id,created_at desc);
alter table private.buklod_official_wall_audit_v1 enable row level security;
revoke all on private.buklod_official_wall_audit_v1 from public,anon,authenticated;

create or replace function public.admin_list_buklod_official_wall_v1(
 p_limit integer default 30,
 p_before_created timestamptz default null,
 p_before_id uuid default null,
 p_status text default 'ALL',
 p_search text default null
) returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_actor uuid:=auth.uid();v_status text:=upper(trim(coalesce(p_status,'ALL')));v_rows jsonb;
begin
 if v_actor is null or not private.buklod_is_platform_official_v1(v_actor)
    or not public.buklod_is_system_admin() then raise exception 'BUKLOD Official required' using errcode='42501';end if;
 if v_status not in ('ALL','VISIBLE','HIDDEN') then raise exception 'Invalid Wall filter';end if;
 if p_before_created is not null and p_before_id is null then raise exception 'Incomplete cursor';end if;
 select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'author_id',x.user_id,'author_name',x.author_name,'body',x.body,
    'created_at',x.created_at,'is_hidden',x.is_hidden,'is_reel',x.is_reel,
    'audience',x.audience,'media_mime_type',x.media_mime_type
   ) order by x.created_at desc,x.id desc),'[]'::jsonb)
 into v_rows
 from (
   select p.id,p.user_id,coalesce(pr.full_name,'BUKLOD Member') as author_name,
     left(p.body,1000) as body,p.created_at,p.is_hidden,p.is_reel,p.audience,p.media_mime_type
   from public.community_posts p
   left join public.profiles pr on pr.id=p.user_id
   where p.audience='public' and p.deleted_at is null
     and (v_status='ALL' or (v_status='VISIBLE' and not p.is_hidden)
       or (v_status='HIDDEN' and p.is_hidden))
     and (p_before_created is null or (p.created_at,p.id)<(p_before_created,p_before_id))
     and (coalesce(trim(p_search),'')='' or p.body ilike '%'||left(trim(p_search),80)||'%'
       or pr.full_name ilike '%'||left(trim(p_search),80)||'%')
   order by p.created_at desc,p.id desc limit least(greatest(coalesce(p_limit,30),1),50)
 ) x;
 return jsonb_build_object('rows',v_rows);
end;
$$;
revoke all on function public.admin_list_buklod_official_wall_v1(integer,timestamptz,uuid,text,text) from public,anon;
grant execute on function public.admin_list_buklod_official_wall_v1(integer,timestamptz,uuid,text,text) to authenticated;

create or replace function public.admin_set_buklod_official_wall_visibility_v1(
 p_post_id uuid,p_hide boolean,p_reason text
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_actor uuid:=auth.uid();v_post public.community_posts%rowtype;
 v_last text;v_reason text:=left(trim(coalesce(p_reason,'')),500);
begin
 if v_actor is null or not private.buklod_is_platform_official_v1(v_actor)
    or not public.buklod_is_system_admin() then raise exception 'BUKLOD Official required' using errcode='42501';end if;
 if p_post_id is null or p_hide is null or length(v_reason)<8 then raise exception 'Post, action and an 8-character reason are required';end if;
 select * into v_post from public.community_posts
    where id=p_post_id and audience='public' and deleted_at is null for update;
 if v_post.id is null then raise exception 'Public Wall post not found';end if;
 if v_post.is_hidden=p_hide then
   return jsonb_build_object('id',v_post.id,'is_hidden',v_post.is_hidden,'idempotent',true);
 end if;
 if not p_hide then
   select a.action into v_last from private.buklod_official_wall_audit_v1 a
      where a.post_id=p_post_id order by a.created_at desc,a.id desc limit 1;
   if v_last is distinct from 'HIDE' then
     raise exception 'Cannot restore content hidden by another safety or privacy workflow';
   end if;
 end if;
 update public.community_posts set is_hidden=p_hide where id=p_post_id;
 insert into private.buklod_official_wall_audit_v1
   (actor_id,post_id,action,prior_hidden,new_hidden,reason)
 values(v_actor,p_post_id,case when p_hide then 'HIDE' else 'RESTORE' end,
   v_post.is_hidden,p_hide,v_reason);
 return jsonb_build_object('id',p_post_id,'is_hidden',p_hide,'idempotent',false);
end;
$$;
revoke all on function public.admin_set_buklod_official_wall_visibility_v1(uuid,boolean,text) from public,anon;
grant execute on function public.admin_set_buklod_official_wall_visibility_v1(uuid,boolean,text) to authenticated;

create table if not exists private.buklod_official_notice_receipts_v1(
 id uuid primary key default gen_random_uuid(),
 actor_id uuid not null references auth.users(id),
 recipient_id uuid not null references auth.users(id),
 nonce text not null,
 title text not null,
 body text not null,
 created_at timestamptz not null default now(),
 unique(actor_id,nonce)
);
alter table private.buklod_official_notice_receipts_v1 enable row level security;
revoke all on private.buklod_official_notice_receipts_v1 from public,anon,authenticated;

create or replace function public.admin_search_buklod_notice_recipients_v1(p_search text,p_limit integer default 15)
returns jsonb language plpgsql stable security definer set search_path to ''
as $$
declare v_actor uuid:=auth.uid();v_list jsonb;
begin
 if v_actor is null or not private.buklod_is_platform_official_v1(v_actor)
    or not public.buklod_is_system_admin() then raise exception 'BUKLOD Official required' using errcode='42501';end if;
 if length(trim(coalesce(p_search,'')))<2 then return '[]'::jsonb;end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,
     'name',p.full_name,'username',p.username) order by p.full_name,p.id),'[]'::jsonb)
 into v_list from (
   select id,full_name,username from public.profiles
   where is_active=true and not private.buklod_is_platform_official_v1(id)
     and (full_name ilike '%'||left(trim(p_search),70)||'%'
       or username ilike '%'||left(trim(p_search),70)||'%')
   order by full_name,id limit least(greatest(coalesce(p_limit,15),1),25)
 ) p;
 return v_list;
end;
$$;
revoke all on function public.admin_search_buklod_notice_recipients_v1(text,integer) from public,anon;
grant execute on function public.admin_search_buklod_notice_recipients_v1(text,integer) to authenticated;

create or replace function public.admin_send_buklod_official_notice_v1(
 p_recipient_id uuid,p_title text,p_body text,p_nonce text
) returns jsonb language plpgsql security definer set search_path to ''
as $$
declare v_actor uuid:=auth.uid();v_id uuid;v_title text:=trim(coalesce(p_title,''));
 v_body text:=trim(coalesce(p_body,''));v_nonce text:=trim(coalesce(p_nonce,''));
begin
 if v_actor is null or not private.buklod_is_platform_official_v1(v_actor)
    or not public.buklod_is_system_admin() then raise exception 'BUKLOD Official required' using errcode='42501';end if;
 if length(v_title) not between 3 and 100 or length(v_body) not between 5 and 1500
    or length(v_nonce) not between 8 and 100 then raise exception 'Invalid notice fields';end if;
 if p_recipient_id is null or not exists(select 1 from public.profiles p
   where p.id=p_recipient_id and p.is_active=true
     and not private.buklod_is_platform_official_v1(p.id)) then
   raise exception 'Active recipient required';
 end if;
 insert into private.buklod_official_notice_receipts_v1
  (actor_id,recipient_id,nonce,title,body)
 values(v_actor,p_recipient_id,v_nonce,v_title,v_body)
 on conflict(actor_id,nonce) do nothing returning id into v_id;
 if v_id is null then
   select id into v_id from private.buklod_official_notice_receipts_v1
    where actor_id=v_actor and nonce=v_nonce and recipient_id=p_recipient_id
      and title=v_title and body=v_body;
   if v_id is null then raise exception 'Notice idempotency key used for a different message';end if;
   return jsonb_build_object('id',v_id,'sent',false,'idempotent',true);
 end if;
 insert into public.notifications(user_id,title,body,kind,data)
 values(p_recipient_id,v_title,v_body,'buklod_official',
   jsonb_build_object('official_sender_id',v_actor,'notice_id',v_id));
 return jsonb_build_object('id',v_id,'sent',true,'idempotent',false);
end;
$$;
revoke all on function public.admin_send_buklod_official_notice_v1(uuid,text,text,text) from public,anon;
grant execute on function public.admin_send_buklod_official_notice_v1(uuid,text,text,text) to authenticated;
