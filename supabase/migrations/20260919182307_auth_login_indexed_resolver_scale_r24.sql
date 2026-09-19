create index if not exists idx_profiles_active_login_identifier_value
on public.profiles (login_identifier)
where is_active = true and login_identifier is not null;

create or replace function public.buklod_auth_candidates_for_service_v2(p_identifier text)
returns table(
  user_id uuid,
  auth_email text,
  login_method text,
  username text,
  full_name text,
  first_name text,
  middle_name text,
  surname text,
  suffix text,
  mobile text,
  role text,
  is_active boolean,
  match_rank integer
)
language sql
stable
security definer
set search_path = 'public', 'auth'
as $function$
  with inp as (
    select
      lower(trim(coalesce(p_identifier,''))) as raw,
      regexp_replace(coalesce(p_identifier,''), '\D', '', 'g') as digits
  ),
  normalized as (
    select
      raw,
      digits,
      case when length(digits) >= 10 then right(digits,10) else null end as last10
    from inp
    where raw <> ''
  ),
  matches as (
    select p.id as user_id, 1 as match_rank
    from public.profiles p
    cross join normalized i
    where p.is_active = true
      and p.login_identifier = i.raw

    union all

    select p.id as user_id, 2 as match_rank
    from auth.users u
    join public.profiles p on p.id = u.id
    cross join normalized i
    where p.is_active = true
      and u.email = i.raw

    union all

    select p.id as user_id, 3 as match_rank
    from public.profiles p
    cross join normalized i
    where p.is_active = true
      and p.username is not null
      and lower(p.username) = i.raw

    union all

    select p.id as user_id, 4 as match_rank
    from public.profiles p
    cross join normalized i
    where p.is_active = true
      and i.last10 is not null
      and p.mobile in ('0' || i.last10, '+63' || i.last10)
  ),
  ranked as (
    select user_id, min(match_rank)::integer as match_rank
    from matches
    group by user_id
  )
  select
    p.id as user_id,
    u.email::text as auth_email,
    p.login_method::text,
    p.username::text,
    p.full_name::text,
    p.first_name::text,
    p.middle_name::text,
    p.surname::text,
    p.suffix::text,
    p.mobile::text,
    p.role::text,
    p.is_active,
    r.match_rank
  from ranked r
  join public.profiles p on p.id = r.user_id
  join auth.users u on u.id = r.user_id
  order by r.match_rank asc, p.created_at desc
  limit 10;
$function$;

revoke all on function public.buklod_auth_candidates_for_service_v2(text)
from public, anon, authenticated;

grant execute on function public.buklod_auth_candidates_for_service_v2(text)
to service_role;

comment on function public.buklod_auth_candidates_for_service_v2(text)
is 'BUKLOD Auth R24 indexed canonical identifier resolver. Uses indexed login identifier, auth email, username and normalized PH mobile paths; service-role only.';
