-- A member can see who follows them, so Community can offer Follow back.
-- This does not reveal anyone else's follow list.

do $$
begin
  if not exists (
    select 1
    from pg_policy
    where polrelid = 'public.buklod_user_follows'::regclass
      and polname = 'Members can see who follows them'
  ) then
    create policy "Members can see who follows them"
      on public.buklod_user_follows
      for select
      to authenticated
      using (followed_user_id = (select auth.uid()));
  end if;
end
$$;
