-- Bahay scoped identity lookup and poll vote correction.
drop policy if exists "Bahay members delete own vote" on public.buklod_home_poll_votes;
create policy "Bahay members delete own vote" on public.buklod_home_poll_votes
for delete to authenticated
using(user_id=(select auth.uid()));

create or replace function public.buklod_home_member_directory_v1(p_home_id uuid)
returns table(user_id uuid,full_name text,username text,avatar_url text)
language sql
stable
security definer
set search_path=''
as $$
  select p.id,p.full_name,p.username,p.avatar_url
  from public.buklod_home_members m
  join public.profiles p on p.id=m.user_id
  where m.home_id=p_home_id
    and m.status='ACTIVE'
    and (m.expires_at is null or m.expires_at>now())
    and public.buklod_home_is_member(p_home_id)
  order by p.full_name nulls last,p.username nulls last;
$$;
revoke all on function public.buklod_home_member_directory_v1(uuid) from public,anon;
grant execute on function public.buklod_home_member_directory_v1(uuid) to authenticated;
