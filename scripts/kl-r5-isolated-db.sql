-- Isolated cloud test for Kabihasnang Ligaw R5. Not for production.
-- The harness creates stub auth, point rules, and the ledger, then this file asserts.

do $$
declare
  member uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
  admin uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
  chapter uuid := '11111111-1111-4111-8111-000000000001';
  panimula uuid := '11111111-1111-4111-8111-000000000000';
  visible_count integer;
  payload jsonb;
  ledger_count integer;
  ledger_points integer;
begin
  if (select prose_sha256 from public.kl_episodes where id = panimula) is distinct from '78195ad435ba17ae033ec6d5649813edd85411b70189a437bf502db96cce77c2' then
    raise exception 'panimula hash mismatch';
  end if;
  if (select prose_sha256 from public.kl_episodes where id = chapter) is distinct from 'fef559f06b20884bb57fd36898c44a1174293a2324823f02af17b48eff463173' then
    raise exception 'chapter hash mismatch';
  end if;
  if (select activation from public.kl_living_layers where episode_id = chapter and layer = 'rain') is distinct from 'FORBIDDEN_NOT_IN_CHAPTER_TEXT' then
    raise exception 'rain layer was not forbidden';
  end if;
  if (select paragraph_start from public.kl_storyboard where scene_id = 's1-e01-shot-05') is null then
    raise exception 'closing scene was not bound';
  end if;
  if exists (select 1 from public.kl_episodes where episode_number = 1 and status <> 'draft') then
    raise exception 'chapter was published by the migration';
  end if;

  insert into auth.users (id) values (member), (admin);

  perform set_config('kl.test_admin', 'off', true);
  perform set_config('request.jwt.claim.sub', member::text, true);
  execute 'set role authenticated';
  select count(*) into visible_count from public.kl_episodes;
  if visible_count <> 0 then
    raise exception 'member can see % draft episodes', visible_count;
  end if;
  payload := public.kl_read_episode_v1(chapter);
  if coalesce((payload->>'readable')::boolean, true) or payload->'content' <> '[]'::jsonb then
    raise exception 'read rpc leaked draft content %', payload;
  end if;
  payload := public.kl_complete_episode_v1(chapter);
  if payload->>'error' is distinct from 'not_readable' then
    raise exception 'complete should refuse unread chapter %', payload;
  end if;
  begin
    perform public.kl_admin_action_v1('approve', chapter, 'no', null, null);
    raise exception 'non-admin approve should have been rejected';
  exception when others then
    if sqlerrm not like '%Not allowed%' then
      raise;
    end if;
  end;
  execute 'reset role';

  perform set_config('kl.test_admin', 'on', true);
  perform set_config('request.jwt.claim.sub', admin::text, true);
  payload := public.kl_admin_action_v1('approve', chapter, 'review', null, null);
  if payload->>'error' is distinct from 'media_blocked' then
    raise exception 'approve should stay blocked without art and audio %', payload;
  end if;

  update public.kl_storyboard
    set approved = true, artwork_status = 'APPROVED', approval_status = 'approved'
    where episode_id = chapter;
  update public.kl_assets
    set approved = true, classification = 'APPROVED'
    where episode_id = chapter and required = true and kind = 'illustration';
  payload := public.kl_admin_action_v1('approve', chapter, 'art only', null, null);
  if payload->>'error' is distinct from 'media_blocked' then
    raise exception 'missing audio should keep the media gate closed %', payload;
  end if;

  update public.kl_assets
    set approved = true, classification = 'APPROVED', required = true
    where kind in ('music', 'ambient');
  payload := public.kl_admin_action_v1('approve', chapter, 'simulated owner approval', null, null);
  if coalesce((payload->>'ok')::boolean, false) is distinct from true then
    raise exception 'approve should accept a fully cleared chapter %', payload;
  end if;
  if (select status from public.kl_seasons where id = '22222222-2222-4222-8222-000000000001') is distinct from 'approved' then
    raise exception 'season did not leave draft after episode approval';
  end if;
  payload := public.kl_admin_action_v1('schedule', chapter, 'release', date '2020-01-02', null);
  if coalesce((payload->>'ok')::boolean, false) is distinct from true then
    raise exception 'schedule failed %', payload;
  end if;

  update public.kl_episodes
    set manuscript_status = 'approved_complete',
        prose_complete = true,
        content = '[{"id":"kl-e00-p001","index":1,"kind":"body","text":"Panimula test"}]'::jsonb,
        media_gate = 'clear',
        status = 'approved',
        approved_at = now()
    where id = panimula;
  update public.kl_storyboard
    set paragraph_start = 1, paragraph_end = 1, approved = true, artwork_status = 'APPROVED'
    where episode_id = panimula;
  update public.kl_assets
    set approved = true, classification = 'APPROVED'
    where episode_id = panimula and required;
  payload := public.kl_admin_action_v1('schedule', panimula, 'same day', date '2020-01-02', null);
  if payload->>'error' is distinct from 'one_episode_per_manila_day' then
    raise exception 'same-day schedule should fail %', payload;
  end if;

  execute 'set role authenticated';
  perform set_config('kl.test_admin', 'off', true);
  perform set_config('request.jwt.claim.sub', member::text, true);
  select count(*) into visible_count from public.kl_episodes;
  if visible_count <> 1 then
    raise exception 'member should see only the released chapter, saw %', visible_count;
  end if;
  payload := public.kl_read_episode_v1(chapter);
  if coalesce((payload->>'readable')::boolean, false) is distinct from true then
    raise exception 'released chapter should be readable %', payload;
  end if;
  if payload->'content' = '[]'::jsonb or position('WAKAS NG KABANATA 1' in payload::text) = 0 then
    raise exception 'released chapter did not return the canonical ending';
  end if;
  payload := public.kl_read_episode_v1(panimula);
  if coalesce((payload->>'readable')::boolean, true) then
    raise exception 'unscheduled panimula became readable %', payload;
  end if;

  payload := public.kl_complete_episode_v1(chapter);
  if coalesce((payload->>'points')::integer, -1) <> 2 or coalesce((payload->>'already_completed')::boolean, true) then
    raise exception 'first completion should award configured 2 points %', payload;
  end if;
  payload := public.kl_complete_episode_v1(chapter);
  if coalesce((payload->>'points')::integer, -1) <> 0 or coalesce((payload->>'already_completed')::boolean, false) is distinct from true then
    raise exception 'replay should not award again %', payload;
  end if;
  execute 'reset role';

  select count(*), coalesce(sum(points), 0)
    into ledger_count, ledger_points
  from public.buklod_points_ledger
  where user_id = member and activity_type = 'kl_episode_completion';
  if ledger_count <> 1 or ledger_points <> 2 then
    raise exception 'ledger count % points %', ledger_count, ledger_points;
  end if;
  if to_regclass('public.bayanihan_ledger') is not null then
    raise exception 'isolated test unexpectedly has a bayanihan ledger';
  end if;
end $$;
