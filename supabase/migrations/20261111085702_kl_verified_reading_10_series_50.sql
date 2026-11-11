-- KL R4 forward-only rewards, Nov 11 2026.
-- Only new verified chapter completions receive 10 BP; series of exactly 30 published
-- and independently verified chapters receives one 50 BP award. Never recredit history.
-- Preserve quiz/time verification, source keys, RLS, concurrency locking and publication gates.
UPDATE public.buklod_point_rules
SET base_points = CASE activity_type WHEN 'kl_episode' THEN 10 ELSE 50 END,
    max_points_per_event = CASE activity_type WHEN 'kl_episode' THEN 10 ELSE 50 END,
    notes='KL R4 verified forward-only completion. Legacy catalog family remains inactive; award only through kl_reading_progress_v1.',
    updated_at=now()
WHERE activity_type IN ('kl_episode','kl_season');

CREATE OR REPLACE FUNCTION public.kl_reading_progress_v1(p_episode_id uuid, p_action text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_user uuid:=auth.uid();
 v_session public.kl_reading_sessions%rowtype;
 v_episode public.kl_episodes%rowtype;
 v_chapter_awarded boolean:=false;
 v_series_awarded boolean:=false;
 v_season_count integer;v_finished integer;v_ledger_id uuid;
begin
 if v_user is null then raise exception 'Sign in required';end if;
 select * into v_episode from public.kl_episodes
 where id=p_episode_id and status='approved' and approved_at is not null
   and release_at<=now() for share;
 if not found then raise exception 'Chapter not released';end if;
 if p_action='start' then
  insert into public.kl_reading_sessions(user_id,episode_id) values(v_user,p_episode_id)
  on conflict(user_id,episode_id) do nothing;
 elsif p_action='ping' then
  update public.kl_reading_sessions
  set last_ping_at=now(),ping_count=least(10000,ping_count+1)
  where user_id=v_user and episode_id=p_episode_id and completed_at is null
    and last_ping_at<=now()-interval '15 seconds';
 elsif p_action='complete' then
  select * into v_session from public.kl_reading_sessions
  where user_id=v_user and episode_id=p_episode_id for update;
  if not found OR (
   NOT EXISTS (
     SELECT 1 FROM public.kl_quiz_attempts a
     JOIN public.kl_quiz_sets q ON q.episode_id=a.episode_id
     WHERE a.user_id=v_user AND a.episode_id=p_episode_id
       AND a.verified_at IS NOT NULL AND a.manuscript_hash=q.manuscript_hash
       AND q.status='ready'
   )
   AND (
     coalesce((SELECT enforce_quiz FROM public.kl_quiz_rollout WHERE id=1),false)
     OR v_session.started_at>now()-interval '60 seconds'
     OR v_session.ping_count<2
   )
  ) then
   return jsonb_build_object('completed',false,'reason','reading_engagement_not_verified',
    'points_awarded',0,'chapter_points',0,'series_points',0);
  end if;
  if v_session.completed_at is null then
   update public.kl_reading_sessions set completed_at=now()
   where user_id=v_user and episode_id=p_episode_id;
   perform public.buklod_award_verification_points_v1(
      v_user,10,'kl_episode_completion',
      'kl:episode:'||v_user::text||':'||p_episode_id::text,p_episode_id,
      'KL verified chapter completion +10 BP',null);
   v_chapter_awarded:=true;
  end if;
  select count(*) into v_season_count from public.kl_episodes
   where season_number=v_episode.season_number and status='approved' and release_at<=now();
  select count(*) into v_finished from public.kl_reading_sessions s
   join public.kl_episodes e on e.id=s.episode_id
   where s.user_id=v_user and s.completed_at is not null
    and e.season_number=v_episode.season_number and e.status='approved'
    and e.release_at<=now();
  if v_season_count=30 and v_finished=30 then
   perform public.buklod_award_verification_points_v1(
    v_user,50,'kl_season_completion',
    'kl:season:'||v_user::text||':'||v_episode.season_number::text,p_episode_id,
    'KL all 30 chapters verified: full series +50 BP',null);
   insert into public.kl_story_achievements(user_id,achievement_key,episode_id)
    values(v_user,'kl:season:'||v_episode.season_number::text,p_episode_id)
    on conflict do nothing;
   -- Only report new bonus if this verified ledger event was freshly created in this transaction.
   select exists(select 1 from public.buklod_points_ledger l
    where l.user_id=v_user and l.activity_type='kl_season_completion'
     and l.source_key='kl:season:'||v_user::text||':'||v_episode.season_number::text
     and l.created_at>=transaction_timestamp()) into v_series_awarded;
  end if;
 else raise exception 'Invalid reading action';end if;
 return jsonb_build_object('ok',true,'completed',p_action='complete',
   'new_completion',v_chapter_awarded,
   'chapter_points',case when v_chapter_awarded then 10 else 0 end,
   'series_points',case when v_series_awarded then 50 else 0 end,
   'points_awarded',(case when v_chapter_awarded then 5 else 0 end)+
      (case when v_series_awarded then 50 else 0 end));
end;
$function$;


REVOKE ALL ON FUNCTION public.kl_reading_progress_v1(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kl_reading_progress_v1(uuid,text) TO authenticated;
