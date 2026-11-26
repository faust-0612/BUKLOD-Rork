-- Apply only after deploying kl-dictionary-worker and provisioning the SAME
-- independent 64-hex KL_DICTIONARY_WORKER_KEY in Vault and Edge secrets.
-- Vault KL_DICTIONARY_WORKER_URL must point at this environment's worker.
-- Deploy with gateway JWT verification disabled; worker checks dedicated secret.
begin;
create function private.kl_dictionary_dispatch_v1() returns bigint
language plpgsql security definer set search_path='' as $$
declare k text; u text; r bigint;
begin
 select decrypted_secret into k from vault.decrypted_secrets where name='KL_DICTIONARY_WORKER_KEY';
 select decrypted_secret into u from vault.decrypted_secrets where name='KL_DICTIONARY_WORKER_URL';
 if k is null or k !~ '^[a-f0-9]{64}$' or u is null or u !~ '^https://[a-z0-9]+\.supabase\.co/functions/v1/kl-dictionary-worker$' then return null; end if;
 -- No network or AI requests when every current published source is terminal/ready.
 if not exists(select 1 from public.kl_episodes e cross join lateral (select private.kl_dictionary_source_v1(e.id) manuscript) s
 left join private.kl_dictionary_jobs_v1 j on j.episode_id=e.id and j.source_hash=md5(s.manuscript)
 where s.manuscript is not null and length(s.manuscript) between 100 and 200000 and
 (j.episode_id is null or (j.next_attempt<=now() and (j.state in ('pending','failed') or (j.state='running' and j.lease_until<now()))))) then return null; end if;
 select net.http_post(url:=u,headers:=jsonb_build_object('Authorization','Bearer '||k,'Content-Type','application/json'),body:='{}'::jsonb,timeout_milliseconds:=60000) into r;
 return r;
end $$;
revoke all on function private.kl_dictionary_dispatch_v1() from public,anon,authenticated;
select cron.schedule('buklod-kl-dictionary-v1','*/15 * * * *','select private.kl_dictionary_dispatch_v1()');
commit;
