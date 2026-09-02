const fs=require('fs');
const path=require('path');

/* ============================================================
   DATABASE MIGRATION
============================================================ */

const migration=path.resolve(
  'supabase/migrations/20260812032500_patch154v_c_bible_any_reviewer.sql'
);

const sql=String.raw`
-- ============================================================
-- PATCH 154V-C
-- DAILY BIBLE REVIEW:
-- ASSIGNED MENTOR OR LOCAL PASTOR OR SYSTEM ADMIN
-- FIRST VALID REVIEWER WINS
-- ============================================================


-- ============================================================
-- 1. REVIEWER ASSIGNMENT LIST
-- ============================================================

create or replace function
public.reviewer_list_daily_bible_assignments_v2()
returns table(
  id uuid,
  reading_date date,
  bible_reference text
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid := (select auth.uid());

  actor_is_admin boolean :=
    public.is_system_admin();

  actor_is_pastor boolean :=
    public.has_app_role(
      actor,
      'pastor'
    );

  actor_is_mentor boolean :=
    public.has_capability(
      actor,
      'mentor'
    );
begin

  if actor is null then
    raise exception
      'Authentication required';
  end if;

  if not (
    actor_is_admin
    or actor_is_pastor
    or actor_is_mentor
  ) then
    raise exception
      'Mentor, Pastor or System Admin access required';
  end if;

  return query

  select
    a.id,
    a.reading_date,
    a.bible_reference

  from public.daily_bible_assignments a

  where
    a.is_published=true

    and (
      actor_is_admin

      or actor_is_pastor

      or (
        actor_is_mentor
        and exists(
          select 1

          from
            public.daily_bible_assignment_members am

          join
            public.mentor_assignments ma
              on ma.disciple_id=
                 am.user_id

          where
            am.assignment_id=a.id

            and ma.mentor_id=actor

            and ma.is_active=true
        )
      )
    )

  order by
    a.reading_date desc

  limit 21;

end;
$$;

revoke all on function
public.reviewer_list_daily_bible_assignments_v2()
from public;

grant execute on function
public.reviewer_list_daily_bible_assignments_v2()
to authenticated;



-- ============================================================
-- 2. REVIEW MONITOR
-- ============================================================

create or replace function
public.reviewer_get_daily_bible_monitor_v2(
  p_assignment_id uuid
)
returns table(
  assignment_id uuid,
  reading_date date,
  bible_reference text,

  user_id uuid,
  full_name text,

  church_id uuid,
  church_name text,

  submission_id uuid,

  bible_text text,
  bible_photo_path text,

  reflection_text text,
  reflection_photo_path text,

  submission_status text,

  submitted_at timestamptz,
  submitted_on_time boolean,

  has_bible_photo boolean,
  has_reflection_photo boolean,

  reviewer_can_act boolean
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  actor uuid :=
    (select auth.uid());

  local_today date :=
    (
      now()
      at time zone 'Asia/Manila'
    )::date;

  actor_is_admin boolean :=
    public.is_system_admin();

  actor_is_pastor boolean :=
    public.has_app_role(
      actor,
      'pastor'
    );

  actor_is_mentor boolean :=
    public.has_capability(
      actor,
      'mentor'
    );

begin

  if actor is null then
    raise exception
      'Authentication required';
  end if;

  if not (
    actor_is_admin
    or actor_is_pastor
    or actor_is_mentor
  ) then
    raise exception
      'Mentor, Pastor or System Admin access required';
  end if;


  return query

  select

    a.id,
    a.reading_date,
    a.bible_reference,

    p.id,
    p.full_name,

    p.church_id,
    coalesce(
      c.name,
      'No Local'
    )::text,

    s.id,

    s.bible_text,
    s.bible_photo_path,

    s.answer_text,
    s.reflection_photo_path,

    (
      case

        when
          s.id is null
          and a.reading_date<local_today
        then
          'missed'

        when s.id is null
        then
          'not_submitted'

        else
          s.status

      end
    )::text,

    s.submitted_at,

    coalesce(
      s.submitted_on_time,
      false
    ),

    (
      s.bible_photo_path is not null

      and exists(
        select 1
        from storage.objects o
        where
          o.bucket_id=
            'daily-bible-evidence'
          and
          o.name=
            s.bible_photo_path
      )
    ),

    (
      s.reflection_photo_path is not null

      and exists(
        select 1
        from storage.objects o
        where
          o.bucket_id=
            'daily-bible-evidence'
          and
          o.name=
            s.reflection_photo_path
      )
    ),

    (
      s.id is not null

      and s.status='pending_admin'

      and (

        actor_is_admin

        or (
          actor_is_pastor

          and actor<>p.id

          and public.can_validate_formation_member(
            p.id
          )
        )

        or (
          actor_is_mentor

          and exists(
            select 1

            from
              public.mentor_assignments ma

            where
              ma.mentor_id=actor

              and
              ma.disciple_id=p.id

              and
              ma.is_active=true
          )
        )
      )
    )


  from
    public.daily_bible_assignment_members am

  join
    public.daily_bible_assignments a
      on a.id=am.assignment_id

  join
    public.profiles p
      on p.id=am.user_id

  left join
    public.churches c
      on c.id=p.church_id

  left join
    public.daily_bible_submissions s
      on
        s.assignment_id=
          am.assignment_id
        and
        s.user_id=
          am.user_id


  where
    am.assignment_id=
      p_assignment_id

    and (

      actor_is_admin

      or (
        actor_is_pastor

        and (
          actor=p.id

          or
          public.can_validate_formation_member(
            p.id
          )
        )
      )

      or (
        actor_is_mentor

        and exists(
          select 1

          from
            public.mentor_assignments ma

          where
            ma.mentor_id=actor

            and
            ma.disciple_id=p.id

            and
            ma.is_active=true
        )
      )
    )


  order by

    case

      when
        s.status='pending_admin'
      then 1

      when
        s.status='rejected'
      then 2

      when
        s.id is null
        and
        a.reading_date<local_today
      then 3

      when
        s.id is null
      then 4

      else 5

    end,

    c.name nulls last,

    p.full_name;

end;
$$;

revoke all on function
public.reviewer_get_daily_bible_monitor_v2(uuid)
from public;

grant execute on function
public.reviewer_get_daily_bible_monitor_v2(uuid)
to authenticated;



-- ============================================================
-- 3. REVIEW ACTION
--
-- FIRST VALID REVIEWER WINS because:
--   SELECT ... FOR UPDATE
--   +
--   status must still be pending_admin
-- ============================================================

create or replace function
public.admin_review_daily_bible_submission(
  p_submission_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare

  actor uuid :=
    (select auth.uid());

  rec record;

  actor_is_admin boolean :=
    public.is_system_admin();

  actor_is_pastor boolean :=
    public.has_app_role(
      actor,
      'pastor'
    );

  actor_is_mentor boolean :=
    public.has_capability(
      actor,
      'mentor'
    );

  actor_is_assigned_mentor boolean :=
    false;

  has_bible_photo boolean :=
    false;

  has_reflection_photo boolean :=
    false;

  valid_question_answers integer :=
    0;

begin

  if actor is null then
    raise exception
      'Authentication required';
  end if;


  select
    s.*,
    a.bible_reference,
    a.reading_date

  into rec

  from
    public.daily_bible_submissions s

  join
    public.daily_bible_assignments a
      on a.id=
         s.assignment_id

  where
    s.id=
      p_submission_id

  for update of s;


  if rec.id is null then
    raise exception
      'Bible Reading submission not found';
  end if;


  if actor_is_mentor then

    select exists(
      select 1

      from
        public.mentor_assignments ma

      where
        ma.mentor_id=actor

        and
        ma.disciple_id=
          rec.user_id

        and
        ma.is_active=true
    )

    into
      actor_is_assigned_mentor;

  end if;


  if not (

    actor_is_admin

    or (
      actor_is_pastor

      and
      actor<>rec.user_id

      and
      public.can_validate_formation_member(
        rec.user_id
      )
    )

    or
      actor_is_assigned_mentor

  ) then

    raise exception
      'You are not authorized to review this Bible Reading';

  end if;


  /*
   * Once another eligible reviewer acted,
   * nobody can review the same pending submission again.
   */
  if rec.status<>'pending_admin' then

    raise exception
      'This Bible Reading submission has already been reviewed';

  end if;


  if rec.bible_photo_path is not null then

    select exists(
      select 1

      from
        storage.objects o

      where
        o.bucket_id=
          'daily-bible-evidence'

        and
        o.name=
          rec.bible_photo_path
    )

    into
      has_bible_photo;

  end if;


  if rec.reflection_photo_path is not null then

    select exists(
      select 1

      from
        storage.objects o

      where
        o.bucket_id=
          'daily-bible-evidence'

        and
        o.name=
          rec.reflection_photo_path
    )

    into
      has_reflection_photo;

  end if;


  if p_approve then

    /*
     * New 4-question requirement.
     */
    if
      rec.question_answers is null

      or
      jsonb_typeof(
        rec.question_answers
      )<>'array'

      or
      jsonb_array_length(
        rec.question_answers
      )<>4
    then

      raise exception
        'Cannot approve: all four Daily Bible questions must be answered';

    end if;


    select
      count(*)

    into
      valid_question_answers

    from
      jsonb_array_elements_text(
        rec.question_answers
      ) q(answer_value)

    where
      char_length(
        trim(
          q.answer_value
        )
      )>=10;


    if valid_question_answers<>4 then

      raise exception
        'Cannot approve: all four Daily Bible question answers must be complete';

    end if;


    if
      coalesce(
        char_length(
          trim(
            rec.bible_text
          )
        ),
        0
      )<20

      and
      not has_bible_photo
    then

      raise exception
        'Cannot approve: Bible passage evidence is missing';

    end if;


    if
      coalesce(
        char_length(
          trim(
            rec.answer_text
          )
        ),
        0
      )<20

      and
      not has_reflection_photo
    then

      raise exception
        'Cannot approve: reflection evidence is missing';

    end if;


    update
      public.daily_bible_submissions

    set
      status='approved',

      reviewed_by=actor,

      reviewed_at=now(),

      admin_note=
        nullif(
          trim(
            coalesce(
              p_admin_note,
              ''
            )
          ),
          ''
        )

    where
      id=p_submission_id;


    /*
     * Preserve existing Bayanihan reward behavior.
     */
    if rec.reward_amount>0 then

      insert into
        public.bayanihan_ledger(
          user_id,
          direction,
          amount,
          source_type,
          source_key,
          source_id,
          description,
          approved_by
        )

      values(
        rec.user_id,

        'credit',

        rec.reward_amount,

        'bible_reading',

        'bible_reading:' ||
          rec.user_id::text ||
          ':' ||
          rec.assignment_id::text,

        rec.id,

        'Daily Bible Reading: ' ||
          rec.bible_reference ||
          ' (' ||
          rec.reading_date::text ||
          ')',

        actor
      )

      on conflict(
        user_id,
        source_key
      )
      do nothing;

    end if;


  else

    /*
     * Return for revision.
     * Member can revise/resubmit.
     */
    update
      public.daily_bible_submissions

    set
      status='rejected',

      reviewed_by=actor,

      reviewed_at=now(),

      admin_note=
        coalesce(
          nullif(
            trim(
              coalesce(
                p_admin_note,
                ''
              )
            ),
            ''
          ),

          'Please revise your Bible questions and/or Personal Reflection, then resubmit.'
        )

    where
      id=p_submission_id;

  end if;

end;
$$;

revoke all on function
public.admin_review_daily_bible_submission(
  uuid,
  boolean,
  text
)
from public;

grant execute on function
public.admin_review_daily_bible_submission(
  uuid,
  boolean,
  text
)
to authenticated;



-- ============================================================
-- 4. EVIDENCE PHOTO ACCESS
-- ============================================================

drop policy if exists
"Daily Bible reviewers view evidence"
on storage.objects;


create policy
"Daily Bible reviewers view evidence"

on storage.objects

for select

to authenticated

using(

  bucket_id=
    'daily-bible-evidence'

  and exists(

    select 1

    from
      public.profiles p

    where
      p.id::text=
        (
          storage.foldername(name)
        )[1]

      and (

        public.is_system_admin()

        or (

          public.has_app_role(
            (select auth.uid()),
            'pastor'
          )

          and (

            p.id=
              (select auth.uid())

            or

            public.can_validate_formation_member(
              p.id
            )
          )
        )

        or (

          public.has_capability(
            (select auth.uid()),
            'mentor'
          )

          and exists(

            select 1

            from
              public.mentor_assignments ma

            where
              ma.mentor_id=
                (select auth.uid())

              and
              ma.disciple_id=
                p.id

              and
              ma.is_active=true
          )
        )
      )
  )
);


notify pgrst, 'reload schema';
`;

fs.writeFileSync(
  migration,
  sql,
  'utf8'
);


/* ============================================================
   APP: SHOW BIBLE VALIDATION TO MENTOR
============================================================ */

const meFile=
  path.resolve(
    'src/app/(tabs)/me.tsx'
  );

if(fs.existsSync(meFile)){

  let me=
    fs.readFileSync(
      meFile,
      'utf8'
    );

  const backup=
    meFile+
    '.bak154v_c';

  if(!fs.existsSync(backup)){
    fs.copyFileSync(
      meFile,
      backup
    );
  }

  /*
   * Change ONLY the Pastor gate immediately surrounding
   * Bible Reading Validation.
   */
  me=me.replace(
    /\{isPastor\s*&&\s*\(\s*<MenuRow([\s\S]*?title=["']Bible Reading Validation["'][\s\S]*?<\/MenuRow>\s*)\)\}/,
    `{(isPastor || isMentor) && (
            <MenuRow$1)}
`
  );

  fs.writeFileSync(
    meFile,
    me,
    'utf8'
  );
}


/* ============================================================
   APP: REVIEWER LABEL
============================================================ */

const monitorFile=
  path.resolve(
    'src/components/BibleReadingMonitor.tsx'
  );

if(fs.existsSync(monitorFile)){

  let monitor=
    fs.readFileSync(
      monitorFile,
      'utf8'
    );

  const backup=
    monitorFile+
    '.bak154v_c';

  if(!fs.existsSync(backup)){
    fs.copyFileSync(
      monitorFile,
      backup
    );
  }

  monitor=
    monitor.replace(
      /const\s+reviewerLabel\s*=\s*hasRole\(['"]system_admin['"]\)\s*\?\s*['"]SYSTEM ADMIN REVIEW['"]\s*:\s*['"]PASTOR REVIEW['"]\s*;/,
`const reviewerLabel=
    hasRole('system_admin')
      ? 'SYSTEM ADMIN REVIEW'
      : hasRole('mentor')
        ? 'MENTOR REVIEW'
        : 'PASTOR REVIEW';`
    );

  fs.writeFileSync(
    monitorFile,
    monitor,
    'utf8'
  );
}


console.log('');
console.log('PATCH 154V-C WRITTEN');
console.log('✓ assigned Mentor may review own disciples');
console.log('✓ Local Pastor retains scoped review');
console.log('✓ System Admin retains global review');
console.log('✓ first valid reviewer finalizes submission');
console.log('✓ 4 question answers validated before approval');
console.log('✓ Return for Revision still allows resubmission');
console.log('✓ Bayanihan reward behavior preserved');
console.log('✓ Mentor evidence-photo access added');
console.log('');

