-- BUKLOD Organization -> Generic Institutional Workspace R1
-- Targeted gap fix only: reuse buklod_scope_bulletins for Organization announcements.
-- No new announcement architecture and no financial changes.

drop policy if exists buklod_scope_bulletins_admin_insert
  on public.buklod_scope_bulletins;

create policy buklod_scope_bulletins_admin_insert
  on public.buklod_scope_bulletins
  for insert
  to authenticated
  with check (
    public.buklod_is_scope_admin(scope_id)
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.buklod_scopes s
      where s.id = buklod_scope_bulletins.scope_id
        and s.scope_type in ('CLUSTER','CHURCH','ORGANIZATION')
        and coalesce(s.status,'ACTIVE') not in ('DELETED','ARCHIVED')
    )
  );

drop policy if exists buklod_scope_bulletins_admin_update
  on public.buklod_scope_bulletins;

create policy buklod_scope_bulletins_admin_update
  on public.buklod_scope_bulletins
  for update
  to authenticated
  using (
    public.buklod_is_scope_admin(scope_id)
  )
  with check (
    public.buklod_is_scope_admin(scope_id)
    and exists (
      select 1
      from public.buklod_scopes s
      where s.id = buklod_scope_bulletins.scope_id
        and s.scope_type in ('CLUSTER','CHURCH','ORGANIZATION')
        and coalesce(s.status,'ACTIVE') not in ('DELETED','ARCHIVED')
    )
  );
