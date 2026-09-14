-- BUKLOD Community Living R2 — remove ambiguous resolve RPC overload.
-- Keep the 1-arg canonical resolver unambiguous for Supabase RPC calls, while
-- retaining the explicit legacy 2-arg resolver without a default value.

begin;

drop function if exists public.resolve_buklod_community_chain_v1(uuid,uuid);

create function public.resolve_buklod_community_chain_v1(
  p_post_id uuid,
  p_helpful_dugtong_id uuid
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_actor is null then raise exception 'Authentication required'; end if;

  select public.buklod_community_root_owner_v1(p_post_id) into v_owner;
  if v_owner is null then raise exception 'Post not found'; end if;
  if v_owner is distinct from v_actor then
    raise exception 'Only the original poster may resolve this chain';
  end if;

  if p_helpful_dugtong_id is not null then
    if not exists(
      select 1
      from public.buklod_community_dugtongs d
      where d.id=p_helpful_dugtong_id
        and d.root_post_id=p_post_id
        and d.deleted_at is null
        and d.moderation_state='approved'
    ) then
      raise exception 'Helpful Dugtong is not available in this chain';
    end if;

    perform public.set_buklod_dugtong_helpful_v1(
      p_helpful_dugtong_id,
      true
    );
  end if;

  update public.buklod_community_post_meta
  set chain_status='resolved',
      resolved_dugtong_id=coalesce(p_helpful_dugtong_id,resolved_dugtong_id),
      updated_at=now()
  where post_id=p_post_id;
end
$$;

revoke all on function public.resolve_buklod_community_chain_v1(uuid,uuid)
  from public,anon;
grant execute on function public.resolve_buklod_community_chain_v1(uuid,uuid)
  to authenticated;

commit;
