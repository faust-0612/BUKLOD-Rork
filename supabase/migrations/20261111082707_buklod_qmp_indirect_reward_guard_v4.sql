-- Qualified source-only indirect rewards. Existing cash/settlements untouched.
CREATE OR REPLACE FUNCTION private.buklod_community_qmp_after_post_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_period private.buklod_community_settlement_periods;
  v_rule private.buklod_community_qmp_rule_versions;
  v_min integer:=40; v_post bigint:=5; v_video bigint:=10; v_is_video boolean; v_awarded uuid;
begin
  if new.user_id is null or new.is_reel=true or new.is_hidden or new.deleted_at is not null then return new; end if;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_min:=coalesce((v_rule.config#>>'{qualification,post_min_chars}')::integer,40);
  v_post:=coalesce((v_rule.config#>>'{base_qmp,useful_post}')::bigint,5);
  v_video:=coalesce((v_rule.config#>>'{base_qmp,qualified_video}')::bigint,10);
  v_is_video:=lower(coalesce(new.media_mime_type,'')) like 'video/%';
  if v_is_video then
    v_awarded:=private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'QUALIFIED_VIDEO',
      v_video,0,'QUALIFIED','QUALIFIED','VIDEO_BASE',jsonb_build_object('audience',new.audience));
    if v_awarded is not null and exists(
      select 1 from private.buklod_community_qmp_events where id=v_awarded and state='QUALIFIED'
    ) then
      perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'QUALIFIED_VIDEO');
    end if;
  elsif length(trim(coalesce(new.body,'')))>=v_min or new.media_path is not null then
    v_awarded:=private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'QUALIFIED','QUALIFIED','POST_BASE',jsonb_build_object('audience',new.audience));
    if v_awarded is not null and exists(
      select 1 from private.buklod_community_qmp_events where id=v_awarded and state='QUALIFIED'
    ) then
      perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'USEFUL_POST');
    end if;
  else
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.id,'post:'||new.id::text,'USEFUL_POST',
      v_post,0,'PENDING','PENDING','MINIMUM_SUBSTANCE_REVIEW',jsonb_build_object('audience',new.audience));
  end if;
  perform private.buklod_community_qmp_mark_active_day_v1(new.user_id,v_period.id);
  return new;
end;
$function$;
CREATE OR REPLACE FUNCTION private.buklod_community_qmp_after_comment_v1()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_period private.buklod_community_settlement_periods; v_rule private.buklod_community_qmp_rule_versions;
  v_awarded uuid; v_creator uuid; v_min integer:=20; v_days integer:=7; v_reply bigint:=3; v_bonus bigint:=1; v_dup boolean:=false;
begin
  if new.user_id is null or new.is_hidden or new.deleted_at is not null then return new; end if;
  select p.user_id into v_creator from public.community_posts p where p.id=new.post_id;
  v_period:=private.buklod_community_qmp_ensure_period_v1();
  select * into v_rule from private.buklod_community_qmp_rule_versions where rule_version=v_period.rule_version;
  v_min:=coalesce((v_rule.config#>>'{qualification,reply_min_chars}')::integer,20);
  v_days:=coalesce((v_rule.config#>>'{qualification,duplicate_reply_days}')::integer,7);
  v_reply:=coalesce((v_rule.config#>>'{base_qmp,meaningful_reply}')::bigint,3);
  v_bonus:=coalesce((v_rule.config#>>'{engagement_bonus,unique_reaction}')::bigint,1);
  select exists(select 1 from public.comments c where c.user_id=new.user_id and c.id<>new.id
    and c.created_at>=now()-make_interval(days=>v_days)
    and lower(regexp_replace(trim(c.body),'\s+',' ','g'))=lower(regexp_replace(trim(new.body),'\s+',' ','g'))) into v_dup;
  if v_creator is not null and new.user_id<>v_creator and length(trim(coalesce(new.body,'')))>=v_min and not v_dup then
    v_awarded:=private.buklod_community_qmp_record_event_v1(new.user_id,new.post_id,'comment:'||new.id::text,'MEANINGFUL_REPLY',
      v_reply,0,'QUALIFIED','QUALIFIED','MEANINGFUL_REPLY',jsonb_build_object('comment_id',new.id));
    -- Both mission and creator bonus depend on the comment earning QMP.
    if v_awarded is not null and exists(
      select 1 from private.buklod_community_qmp_events where id=v_awarded and state='QUALIFIED'
    ) then
      perform private.buklod_community_qmp_progress_mission_v1(new.user_id,v_period.id,'MEANINGFUL_REPLY');
      perform private.buklod_community_qmp_record_event_v1(v_creator,new.post_id,'creator-comment:'||new.id::text,'VALIDATED_ENGAGEMENT',
        0,v_bonus,'QUALIFIED','QUALIFIED','LEGITIMATE_REPLY_ENGAGEMENT',jsonb_build_object('comment_id',new.id));
    end if;
    perform private.buklod_community_qmp_mark_active_day_v1(new.user_id,v_period.id);
  else
    perform private.buklod_community_qmp_record_event_v1(new.user_id,new.post_id,'comment:'||new.id::text,'MEANINGFUL_REPLY',
      v_reply,0,case when v_dup or new.user_id=v_creator then 'DISQUALIFIED' else 'PENDING' end,
      case when v_dup or new.user_id=v_creator then 'DISQUALIFIED' else 'PENDING' end,
      case when new.user_id=v_creator then 'SELF_THREAD_EXCLUDED' when v_dup then 'DUPLICATE_REPLY' else 'REPLY_QUALITY_REVIEW' end,
      jsonb_build_object('comment_id',new.id));
  end if;
  return new;
end;
$function$;

revoke all on function private.buklod_community_qmp_after_post_v1() from public,anon,authenticated;
revoke all on function private.buklod_community_qmp_after_comment_v1() from public,anon,authenticated;
