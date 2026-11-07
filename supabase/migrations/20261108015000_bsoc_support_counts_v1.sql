-- BSOC exact support totals for existing BUKLOD Support Inbox and Overview.
-- Guarded by authenticated BSOC support.read; no anonymous access.
create or replace function public.buklod_bsoc_support_counts_v1()
returns jsonb
language plpgsql stable security definer set search_path=''
as $function$
declare result jsonb;
begin
  if auth.uid() is null or not coalesce(public.buklod_bsoc_can('bsoc.support.read'),false) then
    raise exception 'BSOC support read access required' using errcode='42501';
  end if;
  select pg_catalog.jsonb_build_object(
    'total',count(*),
    'open',count(*) filter (where status::text not in ('resolved','closed')),
    'new',count(*) filter (where status::text='new'),
    'triaged',count(*) filter (where status::text='triaged'),
    'in_progress',count(*) filter (where status::text='in_progress'),
    'resolved',count(*) filter (where status::text='resolved'),
    'closed',count(*) filter (where status::text='closed')
  ) into result from public.user_feedback;
  return result;
end;
$function$;
revoke all on function public.buklod_bsoc_support_counts_v1() from public, anon;
grant execute on function public.buklod_bsoc_support_counts_v1() to authenticated;
