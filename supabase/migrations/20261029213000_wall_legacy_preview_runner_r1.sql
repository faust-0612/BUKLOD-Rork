-- Self-expiring, bounded background backfill (actual work is Edge-owned).
create or replace function private.buklod_legacy_preview_tick_v1()
returns void language plpgsql security definer set search_path='' as $$
declare
 v_token text;
 v_enabled boolean;
 v_exp timestamptz;
 v_bytes bigint;
 v_remaining bigint;
 v_i int;
begin
 select a.secret,a.enabled,a.expires_at into v_token,v_enabled,v_exp
 from private.buklod_legacy_preview_auth a where a.id=1;
 select coalesce(sum(i.preview_bytes),0)::bigint into v_bytes from public.community_wall_legacy_previews i;
 select count(*)::bigint into v_remaining from private.buklod_legacy_preview_queue q
 where q.status in('pending','processing');
 if not coalesce(v_enabled,false) or v_exp<=now() or v_bytes>48000000 or v_remaining=0 then
   update private.buklod_legacy_preview_auth set enabled=false where id=1;
   perform cron.unschedule('buklod_legacy_preview_backfill_r1');
   return;
 end if;
 -- Up to four tiny jobs/minute; no request receives a user-supplied path.
 for v_i in 1..4 loop
   perform net.http_post(
    url:='https://yhanxndaqbmuzbdqlblu.supabase.co/functions/v1/buklod-wall-preview-backfill',
    headers:=jsonb_build_object('Content-Type','application/json','x-buklod-backfill-token',v_token),
    body:='{}'::jsonb,timeout_milliseconds:=30000
   );
 end loop;
end $$;
revoke all on function private.buklod_legacy_preview_tick_v1() from public,anon,authenticated;
