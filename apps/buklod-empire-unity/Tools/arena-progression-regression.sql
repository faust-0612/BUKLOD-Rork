-- PostgreSQL regression fixture. Run ONLY in a disposable test transaction after candidate schema.
-- Do not run on MAIN; no persistent data changes.
begin;
do $$
declare metrics jsonb; perf jsonb; m jsonb;
begin
 if empire_rewards.grade(29)<>'E' or empire_rewards.grade(30)<>'D' or empire_rewards.grade(50)<>'C' or
    empire_rewards.grade(65)<>'B' or empire_rewards.grade(80)<>'A' or empire_rewards.grade(90)<>'S' or empire_rewards.grade(95)<>'S+' then
   raise exception 'Grade boundaries';
 end if;
 if empire_rewards.grade_xp(95,true)<>40 or empire_rewards.grade_xp(95,false)<>50 or empire_rewards.grade_bp(95)<>8 then raise exception 'Reward grade'; end if;
 m:='{"effective":100,"target":100,"successful":10,"attempts":10,"difficulty":100}';
 if empire_rewards.normalize_metric(m)<>100 then raise exception 'Perfect score'; end if;
 if empire_rewards.normalize_metric('{"effective":0,"target":100,"successful":0,"attempts":10,"difficulty":100}')<>0 then raise exception 'Zero impact'; end if;
 if empire_rewards.normalize_metric('{"effective":50,"target":100,"successful":5,"attempts":10,"difficulty":100}')<>50 then raise exception 'Half impact'; end if;
 begin
   perform empire_rewards.normalize_metric('{"effective":100,"target":0,"successful":10,"attempts":10,"difficulty":100}');
   raise exception 'Expected metric rejection' using errcode='ZX001';
 exception when raise_exception then null; end;
 metrics:=jsonb_build_object('teamwork',m,'combat',m,'objective',m,'support',m,'resource',m,'village',m,'defense',m,'leadership',m);
 perf:=empire_rewards.performance('ace',metrics,90);
 if perf->>'grade'<>'S+' or (perf->>'performance_xp')::int<>300 or (perf->>'bonus_bp')::int<>8 then raise exception 'Perfect grade caps'; end if;
 begin
   perform empire_rewards.performance('ace',metrics||'{"teamwork":null}'::jsonb,90);
   raise exception 'Expected missing teamwork rejection' using errcode='ZX001';
 exception when raise_exception then null; end;
end $$;
rollback;
