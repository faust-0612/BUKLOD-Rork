-- Fix Bahay invite RPC output-column ambiguity.

create or replace function public.buklod_home_invite_v1(
  p_home_id uuid,
  p_identifier text,
  p_role text default 'ADULT',
  p_expires_at timestamptz default null
)
returns table(user_id uuid,full_name text,username text)
language plpgsql security definer
set search_path=''
as $$
declare
  v_target public.profiles%rowtype;
  v_role text;
  v_ident text;
begin
  if not public.buklod_home_is_admin(p_home_id) then
    raise exception 'Home admin access required';
  end if;

  v_ident := lower(regexp_replace(btrim(coalesce(p_identifier,'')),'^@',''));
  if v_ident='' then
    raise exception 'Username or login identifier is required';
  end if;

  select p.* into v_target
  from public.profiles p
  where lower(coalesce(p.username,''))=v_ident
     or lower(coalesce(p.login_identifier,''))=v_ident
  order by case when lower(coalesce(p.username,''))=v_ident then 0 else 1 end
  limit 1;

  if v_target.id is null then
    raise exception 'BUKLOD user not found';
  end if;

  v_role := upper(coalesce(p_role,'ADULT'));
  if v_role not in ('ADMIN','ADULT','TEEN','CHILD','HELPER','GUEST') then
    v_role := 'ADULT';
  end if;

  insert into public.buklod_home_members(home_id,user_id,role,status,invited_by,expires_at)
  values(p_home_id,v_target.id,v_role,'PENDING',(select auth.uid()),p_expires_at)
  on conflict on constraint buklod_home_members_pkey
  do update set
    role=excluded.role,
    status='PENDING',
    invited_by=excluded.invited_by,
    expires_at=excluded.expires_at;

  insert into public.notifications(user_id,title,body,kind,data)
  values(
    v_target.id,
    'Imbitasyon sa Bahay',
    (select h.name from public.buklod_homes h where h.id=p_home_id)||' invited you as Kasambahay.',
    'buklod_home_invite',
    jsonb_build_object('route','/personal-home','home_id',p_home_id)
  );

  return query
  select v_target.id,v_target.full_name,v_target.username;
end $$;

revoke all on function public.buklod_home_invite_v1(uuid,text,text,timestamptz) from public,anon;
grant execute on function public.buklod_home_invite_v1(uuid,text,text,timestamptz) to authenticated;
