
-- BUKLOD BSOC R10: harden System Admin authority + make audit writer internal-only.

create or replace function public.buklod_is_system_admin()
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  with actor as (
    select auth.uid() as user_id
  )
  select coalesce(
    (
      select
        a.user_id is not null
        and exists (
          select 1
          from public.profiles p
          where p.id=a.user_id
            and coalesce(p.is_active,true)=true
        )
        and (
          public.is_system_admin()
          or exists (
            select 1
            from public.buklod_scope_role_assignments ra
            join public.buklod_scopes s on s.id=ra.scope_id
            where ra.user_id=a.user_id
              and ra.role_key='SYSTEM_ADMIN'
              and ra.status='ACTIVE'
              and s.scope_type='SYSTEM'
              and s.status='ACTIVE'
          )
        )
      from actor a
    ),
    false
  )
$$;

revoke all on function public.buklod_is_system_admin() from public, anon;
grant execute on function public.buklod_is_system_admin() to authenticated;

-- Audit writer is an internal primitive. Privileged BSOC wrappers call it as function owner.
-- Normal clients, including operators and System Admin browser sessions, cannot fabricate audit rows directly.
revoke all on function public.buklod_bsoc_record_support_action_audit_v1(
  text,text,text,uuid,uuid,uuid,text,text
) from public, anon, authenticated;

-- Telemetry ingestion remains client-callable by authenticated app users.
revoke all on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) from public, anon;
grant execute on function public.buklod_record_feedback_event_v1(
  text,text,text,text,text,text,text,text,boolean,boolean,uuid,uuid
) to authenticated;
