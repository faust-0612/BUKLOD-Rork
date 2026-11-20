-- Optional outbound contact notice queue. No message is sent by this migration.
-- Provider acceptance is NOT verified recipient delivery, and MUST NOT start
-- the 180-day deletion notice deadline.
create table if not exists private.buklod_contact_notice_delivery_v1(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 campaign text not null check(campaign in ('USERNAME_LOGIN_MIGRATION','DORMANCY_REVIEW')),
 month_key text not null,
 channel text not null check(channel in ('email','sms')),
 status text not null default 'CLAIMED'
   check(status in ('CLAIMED','PROVIDER_ACCEPTED','FAILED','DELIVERED')),
 provider_message_id text,
 claimed_at timestamptz not null default now(),
 accepted_at timestamptz,
 delivered_at timestamptz,
 failure_category text,
 unique(user_id,campaign,month_key)
);
alter table private.buklod_contact_notice_delivery_v1 enable row level security;
revoke all on private.buklod_contact_notice_delivery_v1 from public,anon,authenticated;
create index if not exists buklod_contact_notice_recent_v1
 on private.buklod_contact_notice_delivery_v1(campaign,status,claimed_at desc);

-- Only the trusted service-role worker can claim contacts; no public PII API.
-- Email confirmation in legacy signup may have been automatic, therefore an
-- accepted provider send is NOT treated as identity verification.
create or replace function public.buklod_claim_external_contact_notices_v1(
 p_limit integer default 25,
 p_allow_email boolean default true,
 p_allow_sms boolean default false)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_month text:=to_char(now() at time zone 'Asia/Manila','YYYY-MM'); v_rows jsonb;
begin
 if coalesce((select auth.role()),'')<>'service_role' then
   raise exception 'Service authorization required' using errcode='42501';
 end if;
 if not exists(select 1 from private.buklod_login_contact_policy_v1
    where singleton=true and external_reminders_enabled=true) then
    return jsonb_build_object('enabled',false,'rows','[]'::jsonb);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('buklod-outbound-contact:'||v_month,0));
 with candidates as (
  select p.id as user_id,
     'USERNAME_LOGIN_MIGRATION'::text as campaign,
     case when a.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
           and lower(a.email) not like '%@buklod.invalid'
           and a.email_confirmed_at is not null
        then 'email'
       when a.phone ~ '^\+639[0-9]{9}$'
           and a.phone_confirmed_at is not null
        then 'sms' else null end as channel,
     case when a.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
           and lower(a.email) not like '%@buklod.invalid'
           and a.email_confirmed_at is not null
        then lower(a.email)
       when a.phone ~ '^\+639[0-9]{9}$'
           and a.phone_confirmed_at is not null
        then a.phone else null end as recipient
  from public.profiles p
  join auth.users a on a.id=p.id
  where p.login_method='username' and coalesce(p.is_active,true)=true
  union all
  select c.user_id,'DORMANCY_REVIEW'::text,'email'::text,lower(a.email)
  from private.buklod_dormancy_cases_v1 c
  join auth.users a on a.id=c.user_id
  where c.status='PENDING' and not c.admin_hold
    and c.verified_external_notice_at is null
    and a.email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    and lower(a.email) not like '%@buklod.invalid'
    and a.email_confirmed_at is not null
 ),
 eligible as (
   select c.* from candidates c
   where c.recipient is not null and c.channel is not null
     and ((c.channel='email' and p_allow_email) or (c.channel='sms' and p_allow_sms))
     and not exists(select 1 from private.buklod_contact_notice_delivery_v1 n
          where n.user_id=c.user_id and n.campaign=c.campaign
            and n.month_key=v_month)
   order by c.user_id limit least(greatest(coalesce(p_limit,25),1),50)
 ),
 inserted as (
   insert into private.buklod_contact_notice_delivery_v1(user_id,campaign,month_key,channel)
   select user_id,campaign,v_month,channel from eligible
   on conflict do nothing
   returning id,user_id,campaign,channel
 )
 select coalesce(jsonb_agg(jsonb_build_object(
     'id',n.id,'campaign',n.campaign,'channel',n.channel,
     'recipient',e.recipient
  )),'[]'::jsonb) into v_rows
 from inserted n
 join eligible e on e.user_id=n.user_id and e.campaign=n.campaign;
 return jsonb_build_object('enabled',true,'rows',v_rows);
end $$;
revoke all on function public.buklod_claim_external_contact_notices_v1(integer,boolean,boolean)
 from public,anon,authenticated;
grant execute on function public.buklod_claim_external_contact_notices_v1(integer,boolean,boolean)
 to service_role;

create or replace function public.buklod_finish_external_contact_notice_v1(
 p_id uuid,p_accepted boolean,p_provider_id text default null)
returns void language plpgsql security definer set search_path=''
as $$
begin
 if coalesce((select auth.role()),'')<>'service_role' then
   raise exception 'Service authorization required' using errcode='42501';
 end if;
 update private.buklod_contact_notice_delivery_v1
   set status=case when p_accepted then 'PROVIDER_ACCEPTED' else 'FAILED' end,
       accepted_at=case when p_accepted then now() else null end,
       provider_message_id=left(p_provider_id,255),
       failure_category=case when p_accepted then null else 'SEND_FAILED' end
 where id=p_id and status='CLAIMED';
end $$;
revoke all on function public.buklod_finish_external_contact_notice_v1(uuid,boolean,text)
 from public,anon,authenticated;
grant execute on function public.buklod_finish_external_contact_notice_v1(uuid,boolean,text)
 to service_role;
